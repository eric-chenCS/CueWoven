import {DEFAULT_DOMAINS} from './web-sites.js';
// Bundled public site icons work offline; custom sites use the browser's local cache.
export function bundledFavicon(value,runtime=chrome.runtime){
  try{
    const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;
    const domain=DEFAULT_DOMAINS.find(host=>url.hostname===host||url.hostname.endsWith('.'+host));
    return domain?runtime.getURL('icons/sites/'+domain+'.png'):null;
  }catch{return null;}
}
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
  const website=item.kind&&!item.sample;
  const fallback = runtime.getURL(website?'icons/site.svg':'icons/web.svg');
  const siteIcon = website ? faviconUrl(item.url, runtime) : null;
  const bundled=website?bundledFavicon(item.url,runtime):null;
  const thumbnail = !item.kind && !item.sample && /^[\w-]{11}$/.test(item.videoId || '') ? `https://i.ytimg.com/vi/${encodeURIComponent(item.videoId)}/mqdefault.jpg` : null;
  return [...new Set([item.image, bundled,siteIcon, thumbnail, fallback].filter(Boolean))];
}
export function setItemImage(image, item, runtime = chrome.runtime) {
  const sources = imageSources(item, runtime);
  let index = 0;
  image.referrerPolicy = 'no-referrer';
  image.loading = 'lazy';
  image.decoding = 'async';
  const show = () => {
    const src = sources[index];
    image.classList.toggle('website-icon', src.includes('/_favicon/') || src.includes('/icons/sites/') || /\/icons\/(?:site|web)\.svg$/.test(src));
    if (index) image.alt = '';
    image.src = src;
  };
  image.onerror = () => { if (++index < sources.length) show(); else image.onerror = null; };
  show();
}
