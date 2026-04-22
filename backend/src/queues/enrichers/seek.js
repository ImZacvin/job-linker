import { extractScriptContent, stripHtml } from '../../lib/html.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function findLongHtmlString(obj, depth = 0, best = { value: null, len: 0 }) {
  if (!obj || depth > 8) return best;
  if (typeof obj === 'string') {
    // Looks like HTML-ish job content: has tags and is long.
    if (obj.length > 200 && /<\/?(p|div|ul|li|br|h[1-6]|strong)\b/i.test(obj)) {
      if (obj.length > best.len) return { value: obj, len: obj.length };
    }
    return best;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) best = findLongHtmlString(item, depth + 1, best);
    return best;
  }
  if (typeof obj === 'object') {
    // Prefer obvious keys first for stability across shape changes.
    const preferredKeys = ['content', 'jobAdDetails', 'description', 'body'];
    for (const k of preferredKeys) {
      if (k in obj) best = findLongHtmlString(obj[k], depth + 1, best);
    }
    for (const [k, v] of Object.entries(obj)) {
      if (preferredKeys.includes(k)) continue;
      best = findLongHtmlString(v, depth + 1, best);
    }
  }
  return best;
}

export async function enrichSeek({ url }) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`SEEK fetch ${res.status}`);
  }
  const html = await res.text();

  // Primary: __NEXT_DATA__ JSON island.
  const nextScripts = extractScriptContent(html, '__NEXT_DATA__');
  for (const raw of nextScripts) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const hit = findLongHtmlString(parsed);
    if (hit.value) {
      return { description: stripHtml(hit.value) };
    }
  }

  // Fallback: JSON-LD JobPosting.
  const ldScripts = extractScriptContent(html, 'application/ld\\+json');
  for (const raw of ldScripts) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    for (const c of candidates) {
      if (c && c['@type'] === 'JobPosting' && c.description) {
        return { description: stripHtml(c.description) };
      }
    }
  }

  return { description: null };
}
