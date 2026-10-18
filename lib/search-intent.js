// Interpret explicit viewing context only; quoted text remains literal.
const sources = {youtube:'youtube.com',tiktok:'tiktok.com',instagram:'instagram.com',reddit:'reddit.com'};
export function searchIntent(input, {sinceDays=0, infer=true}={}) {
  let source='', days=sinceDays;
  const parts=String(input||'').split(/(["“][^"”\n]*["”])/g);
  const visible=parts.filter(part=>!/^['"“]/.test(part)).join(' ');
  const viewing=/\b(?:I (?:saw|watched|visited|read|opened|saved)|(?:that|the|a) (?:TikTok|Instagram reel|YouTube video)\b|that short I (?:saw|watched))\b/i.test(visible);
  const query=parts.map(part=>{
    if(!infer||/^["“]/.test(part))return part;
    const site=part.match(/\bfrom (youtube|tiktok|instagram|reddit)\b/i)?.[1]
      ||part.match(/\b(?:that|the|a) (tiktok|instagram)(?: reel)?\b(?=\s+(?:about|I|from|on)\b|$)/i)?.[1]
      ||(viewing?part.match(/\bon (youtube|tiktok|instagram|reddit)\b/i)?.[1]:null)
      ||(/\bthat short I (?:saw|watched)\b/i.test(part)?'youtube':null);
    if(site&&!source)source=sources[site.toLowerCase()];
    let cleaned=part.replace(/\b(?:that|the|a) (tiktok|instagram reel|youtube video)\s+(?:about\s+)?/gi,'$1 ')
      .replace(/\bthat short I (?:saw|watched)\b/gi,'');
    if(viewing||/\bfrom (?:youtube|tiktok|instagram|reddit)\b/i.test(part))cleaned=cleaned.replace(/\b(?:last|past) (week|month)\b(?! tonight)|\btoday\b(?! (?:show|explained))/gi,(match,unit)=>{
      const next=unit?.toLowerCase()==='week'?7:unit?30:1;
      if(days&&days!==next)return match;
      days=next;return ' ';
    });
    cleaned=cleaned.replace(/\bearlier today\b/gi,match=>{if(days&&days!==1)return match;days=1;return ' ';});
    return cleaned;
  }).join('').replace(/\s+/g,' ').trim();
  const labels=[];
  if(source)labels.push(source);
  if(days&&!sinceDays)labels.push(days===1?'past 24 hours':`past ${days} days`);
  return {query,source,sinceDays:days,labels};
}
export async function searchWithFallback(intent,manualDays,load) {
  const primary=await load(intent);
  if(primary.results.length||primary.hasFirst||!intent.labels.length)return {...primary,intent,relaxed:false};
  const relaxed={...intent,source:'',sinceDays:manualDays||0,labels:[]};
  return {...await load(relaxed),intent:relaxed,relaxed:true};
}
export function matchesSource(video, source) {
  if(!source)return true;
  if(!video.url)return source==='youtube.com'&&/^[\w-]{11}$/.test(video.videoId);
  try {const host=new URL(video.url).hostname;return host===source||host.endsWith('.'+source);}catch{return false;}
}
