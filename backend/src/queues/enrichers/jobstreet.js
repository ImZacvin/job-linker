import { extractScriptContent, stripHtml } from '../../lib/html.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * Extract the inner HTML of the jobAdDetails section.
 * JobStreet Indonesia server-renders the description directly in the HTML
 * inside a div/section with data-automation="jobAdDetails" or id="jobAdDetails".
 * The pattern is:  jobAdDetails"><div ...>...</div>
 */
function extractJobAdDetails(html) {
  // Match: jobAdDetails"><CONTENT>  up to the next closing parent tag
  // We grab everything after `jobAdDetails">` until we find the enclosing </div> or </section>
  const startMarker = 'jobAdDetails">';
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return null;

  const contentStart = startIdx + startMarker.length;

  // Walk forward, counting open/close div tags to find the matching close
  let depth = 0;
  let i = contentStart;
  const chunk = html.slice(contentStart, contentStart + 50000); // cap search window

  while (i < chunk.length) {
    const openDiv = chunk.indexOf('<div', i);
    const closeDiv = chunk.indexOf('</div>', i);

    if (closeDiv === -1) break;

    if (openDiv !== -1 && openDiv < closeDiv) {
      depth++;
      i = openDiv + 4;
    } else {
      if (depth === 0) {
        // This </div> closes the immediate wrapper — content is everything before it
        return chunk.slice(0, closeDiv);
      }
      depth--;
      i = closeDiv + 6;
    }
  }

  // Fallback: just grab up to 10000 chars and let stripHtml clean it
  return chunk.slice(0, 10000);
}

export async function enrichJobStreet({ url }) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`JobStreet fetch ${res.status}`);
  }
  const html = await res.text();

  // Primary: jobAdDetails section rendered directly in the HTML.
  const adHtml = extractJobAdDetails(html);
  if (adHtml) {
    const text = stripHtml(adHtml);
    if (text && text.length > 100) {
      return { description: text };
    }
  }

  // Secondary: __NEXT_DATA__ JSON island (used on some JobStreet locales).
  const nextScripts = extractScriptContent(html, '__NEXT_DATA__');
  for (const raw of nextScripts) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    // Walk tree looking for jobAdDetails key or longest HTML string
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

function findLongHtmlString(obj, depth = 0, best = { value: null, len: 0 }) {
  if (!obj || depth > 8) return best;
  if (typeof obj === 'string') {
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
