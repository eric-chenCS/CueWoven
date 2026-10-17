export function videoIdFromUrl(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (!['https:', 'http:'].includes(u.protocol)) return null;
    if (u.hostname === 'youtu.be') return /^[\w-]{11}$/.test(u.pathname.slice(1)) ? u.pathname.slice(1) : null;
    if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        return /^[\w-]{11}$/.test(id || '') ? id : null;
      }
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{11})\/?$/);
      if (m) return m[2];
    }
  } catch (_) { /* not a URL */ }
  return null;
}
