// Interpret explicit viewing context only; quoted text remains literal.
const sources = {youtube:'youtube.com',tiktok:'tiktok.com',instagram:'instagram.com',reddit:'reddit.com'};
export function searchIntent(input, {sinceDays=0, infer=true}={}) {
  let source='', days=sinceDays, labels=[];
  const query=String(input||'').split(/(["“][^"”\n]*["”])/g).map(part=>{
    if(!infer||/^["“]/.test(part))return part;
    return part.replace(/\b(?:from|on) (youtube|tiktok|instagram|reddit)\b|\b(?:that|the) (youtube video|tiktok|instagram reel|reel|short)(?: I (?:saw|watched))?\b/gi,(match,site,media)=>{
      const next=site?.toLowerCase()||(media?.toLowerCase().includes('reel')?'instagram':media?.toLowerCase()==='tiktok'?'tiktok':'youtube');
      if(source&&source!==sources[next])return match;
      source=sources[next];return ' ';
    }).replace(/\b(?:last|past) (week|month)\b(?! tonight)|\btoday\b(?! show)/gi,(match,unit)=>{
      const next=unit?.toLowerCase()==='week'?7:unit?30:1;
      if(days&&days!==next)return match;
      days=next;return ' ';
    });
  }).join('').replace(/\s+/g,' ').trim().replace(/^(?:about|on)(?:\s+|$)/i,'').trim();
  if(source)labels.push(source);
  if(days&&!sinceDays)labels.push(days===1?'past 24 hours':`past ${days} days`);
  return {query,source,sinceDays:days,labels};
}
export function matchesSource(video, source) {
  if(!source)return true;
  if(!video.url)return source==='youtube.com'&&/^[\w-]{11}$/.test(video.videoId);
  try {const host=new URL(video.url).hostname;return host===source||host.endsWith('.'+source);}catch{return false;}
}
