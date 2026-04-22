import { extractScriptContent, stripHtml } from '../../lib/html.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export async function enrichGlints({ url }) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`Glints fetch ${res.status}`);
  }
  const html = await res.text();

  const scripts = extractScriptContent(html, 'application/ld\\+json');
  for (const raw of scripts) {
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
