// Browser-provided icons stay under the extension origin; only the site origin is requested.
export function faviconUrl(value, runtime = chrome.runtime) {
  try {
    const site = new URL(value);
    if (!['https:', 'http:'].includes(site.protocol) || site.username || site.password) return null;
    const url = new URL(runtime.getURL('_favicon/'));
    url.searchParams.set('pageUrl', site.origin + '/');
    url.searchParams.set('size', '32');
    return url.href;
  } catch { return null; }
}
export function imageSources(item, runtime = chrome.runtime) {
  const fallback = runtime.getURL('icons/web.svg');
  const siteIcon = item.kind && !item.sample ? faviconUrl(item.url, runtime) : null;
  const thumbnail = !item.kind && !item.sample && /^[\w-]{11}$/.test(item.videoId || '') ? `https://i.ytimg.com/vi/${encodeURIComponent(item.videoId)}/mqdefault.jpg` : null;
  return [...new Set([item.image, siteIcon, thumbnail, fallback].filter(Boolean))];
}
export function setItemImage(image, item, runtime = chrome.runtime) {
  const sources = imageSources(item, runtime);
  let index = 0;
  image.referrerPolicy = 'no-referrer';
  image.loading = 'lazy';
  image.decoding = 'async';
  const show = () => {
    const src = sources[index];
    image.classList.toggle('website-icon', src.includes('/_favicon/') || src.endsWith('/icons/web.svg'));
    if (index) image.alt = '';
    image.src = src;
  };
  image.onerror = () => { if (++index < sources.length) show(); else image.onerror = null; };
  show();
}
