// Interpret explicit viewing context only; quoted text remains literal.
const sources = {youtube:'youtube.com',tiktok:'tiktok.com',instagram:'instagram.com',reddit:'reddit.com',wikipedia:'wikipedia.org',github:'github.com',vimeo:'vimeo.com'};
const siteNames=Object.keys(sources).join('|');
const DAY=864e5, UNITS={day:DAY,week:7*DAY,month:30*DAY,year:365*DAY};
const WORDS={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,'a couple':2,'a couple of':2,couple:2,'couple of':2,'a few':3,few:3};
const NUM=String.raw`\d{1,3}|a couple(?: of)?|couple(?: of)?|a few|few|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve`;
const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
const amount=word=>/^\d/.test(word)?Number(word):WORDS[word.toLowerCase().replace(/\s+/g,' ')];
const unitOf=word=>UNITS[word.toLowerCase()];
function dated(sinceMs,untilMs,match,now){
  if(!(untilMs<now))untilMs=0;
  const year=new Date(now).getFullYear(),day=ms=>new Date(ms).toLocaleDateString(undefined,{month:'short',day:'numeric',...(new Date(ms).getFullYear()!==year?{year:'numeric'}:{})});
  const from=day(sinceMs),to=untilMs?day(untilMs-1):'';
  return {sinceMs:Math.max(0,sinceMs),untilMs,match,label:!to?`since ${from}`:from===to?from:`${from} – ${to}`};
}
// Typed dates are fuzzy memories, so each window is padded; exact ranges come from the Custom dates chip.
export function timeRange(text,{now=Date.now(),viewing=false}={}) {
  const span=text.match(new RegExp(String.raw`\b(?:between\s+)?(${NUM})\s*(?:and|to|-|–)\s*(${NUM})\s+(day|week|month|year)s?\s+ago\b`,'i'));
  const between=(low,high,unit,match)=>{const pad=Math.max(DAY,unit/4);return dated(now-high*unit-pad,now-low*unit+pad,match,now);};
  if(span){const [low,high]=[amount(span[1]),amount(span[2])].sort((a,b)=>a-b);return between(low,high,unitOf(span[3]),span[0]);}
  const ago=text.match(new RegExp(String.raw`\b(${NUM})\s+(day|week|month|year)s?\s+ago\b`,'i'));
  if(ago&&/few/i.test(ago[1]))return between(2,5,unitOf(ago[2]),ago[0]);
  if(ago){const unit=unitOf(ago[2]),center=now-amount(ago[1])*unit,pad=unit===DAY?DAY:unit/2;return dated(center-pad,center+pad,ago[0],now);}
  // These can also be topics ("yesterday's news", "gardening in May"), so they need viewing words.
  if(!viewing)return null;
  const recent=text.match(new RegExp(String.raw`\b(?:last|past)\s+(${NUM})\s+(day|week|month)s?\b`,'i'));
  if(recent)return dated(now-amount(recent[1])*unitOf(recent[2]),0,recent[0],now);
  const yesterday=text.match(/\byesterday\b/i);
  if(yesterday){const start=new Date(now);start.setHours(0,0,0,0);const until=start.getTime();start.setDate(start.getDate()-1);return dated(start.getTime(),until,yesterday[0],now);}
  const month=text.match(new RegExp(String.raw`\b(?:in|during|back in)\s+(${MONTHS.join('|')})(?:\s+(\d{4}))?\b`,'i'));
  if(month){
    const today=new Date(now),index=MONTHS.indexOf(month[1].toLowerCase());
    const year=month[2]?Number(month[2]):index>today.getMonth()?today.getFullYear()-1:today.getFullYear();
    return dated(new Date(year,index,1).getTime()-3*DAY,new Date(year,index+1,1).getTime()+3*DAY,month[0],now);
  }
  return null;
}
export function searchIntent(input, {sinceDays=0, infer=true, manualRange=false, now=Date.now()}={}) {
  let source='', days=sinceDays, range=null;
  const parts=String(input||'').split(/(["“][^"”\n]*["”])/g);
  const visible=parts.filter(part=>!/^['"“]/.test(part)).join(' ');
  const viewing=/\b(?:I (?:saw|watched|visited|read|opened|saved)|(?:that|the|a) (?:TikTok|Instagram reel|YouTube video)\b|that short I (?:saw|watched))\b/i.test(visible);
  const query=parts.map(part=>{
    if(!infer||/^["“]/.test(part))return part;
    // A terminal dot is punctuation; a following hostname label must not become a platform alias.
    const site=part.match(/\bfrom (youtube|tiktok|instagram|reddit)\b(?![@-]|\.+[\w@-])/i)?.[1]
      ||part.match(/\b(?:that|the|a) (tiktok|instagram)(?: reel)?\b(?=\s+(?:about|I|from|on)\b|$)/i)?.[1]
      ||(viewing?part.match(/\bon (youtube|tiktok|instagram|reddit)\b(?![@-]|\.+[\w@-])/i)?.[1]:null)
      ||(/\bthat short I (?:saw|watched)\b/i.test(part)?'youtube':null);
    if(site&&!source)source=sources[site.toLowerCase()];
    const domain=part.match(/\b(?:from|on)\s+(?:https?:\/\/)?((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63})(?![\w@-]|\.+[\w@-])/i)?.[1];
    const explicit=part.match(new RegExp(String.raw`\b(?:from\s+(${siteNames})\b(?![@-]|\.+[\w@-])|(?:^|\b(?:a|an|the|that|this|find|show)\s+)(${siteNames})\s+(?:videos?|clips?|reels?|posts?|articles?|pages?|threads?)\b|on\s+(${siteNames})\b(?![@-]|\.+[\w@-]))`,'i'));
    if(domain)source=domain.toLowerCase().replace(/^www\./,'');
    else if(explicit&&!source&&(viewing||!explicit[3]))source=sources[(explicit[1]||explicit[2]||explicit[3]).toLowerCase()];
    let cleaned=part.replace(/\b(?:that|the|a) (tiktok|instagram reel|youtube video)\s+(?:about\s+)?/gi,'$1 ')
      .replace(/\bthat short I (?:saw|watched)\b/gi,'');
    if(viewing||/\bfrom (?:youtube|tiktok|instagram|reddit)\b/i.test(part))cleaned=cleaned.replace(/\b(?:last|past) (week|month)\b(?! tonight)|\btoday\b(?! (?:show|explained))/gi,(match,unit)=>{
      const next=unit?.toLowerCase()==='week'?7:unit?30:1;
      if(days&&days!==next)return match;
      days=next;return ' ';
    });
    cleaned=cleaned.replace(/\bearlier today\b/gi,match=>{if(days&&days!==1)return match;days=1;return ' ';});
    // A date chosen in the popup wins over one typed in the search.
    if(!days&&!manualRange&&!range){const found=timeRange(cleaned,{now,viewing});if(found){range=found;cleaned=cleaned.replace(found.match,' ');}}
    return cleaned;
  }).join('').replace(/\s+/g,' ').trim();
  const labels=[];
  if(source)labels.push(source);
  if(days&&!sinceDays)labels.push(days===1?'past 24 hours':`past ${days} days`);
  if(range)labels.push(range.label);
  return {query,source,sinceDays:days,labels,...(range?{range:{sinceMs:range.sinceMs,untilMs:range.untilMs}}:{})};
}
export async function searchWithFallback(intent,manualDays,load) {
  const primary=await load(intent);
  if(primary.results.length||primary.hasFirst||!intent.labels.length)return {...primary,intent,relaxed:false};
  if(!intent.range&&intent.sinceDays===(manualDays||0))return {...primary,intent,relaxed:false};
  const {range,...rest}=intent,relaxed={...rest,sinceDays:manualDays||0,labels:intent.source?[intent.source]:[]};
  return {...await load(relaxed),intent:relaxed,relaxed:true};
}
export function matchesSource(video, source) {
  if(!source)return true;
  if(!video.url)return source==='youtube.com'&&/^[\w-]{11}$/.test(video.videoId);
  try {const host=new URL(video.url).hostname;return host===source||host.endsWith('.'+source);}catch{return false;}
}
