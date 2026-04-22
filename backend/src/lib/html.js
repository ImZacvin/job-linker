// Strip characters Postgres text/jsonb columns reject (NUL + other C0 control
// chars, except whitespace we care about: \t \n \r). Also strips the DEL char.
// Safe to call on any string from external sources (PDFs, scraped HTML).
export function sanitizeText(text) {
  if (!text) return '';
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');
}

export function stripHtml(text) {
  if (!text) return '';
  const cleaned = text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return sanitizeText(cleaned);
}

export function extractScriptContent(html, matcher) {
  // matcher: string to find in the script opening tag (e.g. 'application/ld+json', '__NEXT_DATA__')
  const pattern = new RegExp(
    `<script[^>]*${matcher}[^>]*>([\\s\\S]*?)<\\/script>`,
    'gi'
  );
  const results = [];
  let m;
  while ((m = pattern.exec(html)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}
