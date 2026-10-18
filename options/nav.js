// Highlight the side-menu link for the section in view.
const links = new Map([...document.querySelectorAll('.nav a')].map((a) => [a.hash.slice(1), a]));
const mark = (id) => { for (const [key, a] of links) key === id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'); };
const seen = new Map();
const observer = new IntersectionObserver((entries) => {
  for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : null);
  const visible = [...seen].filter(([, top]) => top !== null).sort((a, b) => a[1] - b[1]);
  if (visible.length) mark(visible[0][0]);
}, { rootMargin: '-15% 0px -60% 0px' });
for (const id of links.keys()) { const el = document.getElementById(id); if (el) observer.observe(el); }
mark([...links.keys()][0]);

// Collapsed rows open themselves when something inside starts reporting progress.
for (const msg of document.querySelectorAll('details.fold .msg')) {
  const fold = msg.closest('details');
  new MutationObserver(() => { if (msg.textContent.trim() && !fold.open) fold.open = true; })
    .observe(msg, { subtree: true, childList: true, characterData: true });
}
