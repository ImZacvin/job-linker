import { extractScriptContent, stripHtml } from '../../lib/html.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function tryJobView(externalId) {
  const url = `https://www.linkedin.com/jobs/view/${encodeURIComponent(externalId)}`;
  const res = await fetch(url, {
    headers: {
      'user-agent': UA,
      accept: 'text/html',
      'accept-language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`LinkedIn /jobs/view fetch ${res.status}`);
  }
  const html = await res.text();

  // 1) JSON-LD JobPosting in the public page head.
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
        const text = stripHtml(c.description);
        if (text && text.length > 80) {
          return { description: text, source: 'jobs-view-ldjson' };
        }
      }
    }
  }

  // 2) Public view sometimes renders the description inline in a <section class="description">.
  const sectionMatch = html.match(
    /<section[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/section>/i
  );
  if (sectionMatch) {
    const text = stripHtml(sectionMatch[1]);
    if (text && text.length > 80) {
      return { description: text, source: 'jobs-view-section' };
    }
  }

  return null;
}

async function tryGuestEndpoint(externalId) {
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${encodeURIComponent(
    externalId
  )}`;
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html' },
    redirect: 'follow',
  });
  if (res.status === 429) {
    throw new Error('LinkedIn guest endpoint rate-limited (429)');
  }
  if (!res.ok) {
    throw new Error(`LinkedIn guest fetch ${res.status}`);
  }
  const html = await res.text();

  const sectionMatch = html.match(
    /<section[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/section>/i
  );
  if (sectionMatch) {
    const text = stripHtml(sectionMatch[1]);
    if (text && text.length > 80) {
      return { description: text, source: 'jobs-guest-section' };
    }
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const fallback = stripHtml(bodyMatch ? bodyMatch[1] : html);
  if (fallback && fallback.length > 200) {
    return { description: fallback, source: 'jobs-guest-body' };
  }

  return null;
}

export async function enrichLinkedIn({ external_id }) {
  if (!external_id) {
    throw new Error('LinkedIn enrichment needs external_id');
  }

  // Primary: guest posting endpoint — returns a clean HTML fragment with the
  // description section, no auth needed, no JS render.
  try {
    const guest = await tryGuestEndpoint(external_id);
    if (guest) {
      return { description: guest.description };
    }
  } catch (err) {
    console.warn(`[enrich-linkedin] guest endpoint failed, trying /jobs/view: ${err.message}`);
  }

  // Fallback: public /jobs/view/<id> page (JSON-LD JobPosting when present).
  const view = await tryJobView(external_id);
  if (view) {
    return { description: view.description };
  }

  return { description: null };
}
