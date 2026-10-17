import {validateVideoImage} from './video-image.js';
import './web-policy.js';
export const SCREEN_INTERVAL=5,SCREEN_PER_VIDEO=720,SCREEN_TOTAL=10000;
export const SCREEN_RECENT_ROWS=30;
const lineKey=text=>cleanScreenText(text).normalize('NFKC').toLowerCase();
export function cleanScreenLines(lines){
  let remaining=2000;
  return (Array.isArray(lines)?lines:[]).slice(0,40).filter(line=>typeof line==='string').map(line=>{
    const text=cleanScreenText(line).slice(0,remaining);remaining-=text.length;return text;
  }).filter(text=>(text.match(/\p{L}/gu)||[]).length>=3);
}
// Exact ordered lines only: a changed digit, negation or word order is new evidence.
export function novelScreenLines(lines,recent,start){
  const seen=new Set(recent.filter(row=>Number.isFinite(row.start)&&Math.abs(row.start-start)<30)
    .flatMap(row=>cleanScreenLines(row.observedLines||[row.text])).map(lineKey));
  return cleanScreenLines(lines).filter(line=>{const key=lineKey(line);if(seen.has(key))return false;seen.add(key);return true;});
}
export function validateScreenFrame(frame){
  if(!frame || !globalThis.__recallWebPolicy.ownerId(frame.video?.videoId) || !Number.isFinite(frame.start)||frame.start<0||frame.start>86400*30)throw Error('Invalid on-screen text video or timestamp.');
  validateVideoImage(frame.image,{width:1280,height:720,chars:1500000});return frame;
}
export function cleanScreenText(text){return String(text||'').replace(/[\p{Cc}\p{Cf}]/gu,' ').replace(/\s+/g,' ').trim().slice(0,2000);}
export function isDuplicateScreenLine(a,b){
  const normalize=line=>cleanScreenText(line).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const left=normalize(a),right=normalize(b);
  if(!left||!right)return false;
  if(left===right)return true;
  const leftWords=left.split(' '),rightWords=right.split(' ');
  const leftIsShorter=leftWords.length<=rightWords.length;
  const shorter=leftIsShorter?left:right,longer=leftIsShorter?right:left;
  const shortWords=leftIsShorter?leftWords:rightWords;
  // Only suppress substantial fragments. Short lines can be real headings
  // even when their words appear inside a longer OCR line.
  if(shortWords.length>=4&&` ${longer} `.includes(` ${shorter} `))return true;
  if(shortWords.length<4)return false;
  const longWords=new Set(leftIsShorter?rightWords:leftWords);
  const shared=shortWords.filter(word=>longWords.has(word)).length;
  return shared/shortWords.length>=0.8;
}
// Low-confidence fragments from scenery must not become searchable words.
export function recognizedScreenLines(data){
  const lines=[];
  for(const block of data?.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[]){
    if(!Number.isFinite(line.confidence)||line.confidence<65)continue;
    const text=cleanScreenText((line.words||[]).filter(word=>word.confidence>=65).map(word=>word.text).join(' '));
    if((text.match(/\p{L}/gu)||[]).length<3)continue;
    if(!lines.some(existing=>isDuplicateScreenLine(existing,text)))lines.push(text);
  }
  return lines;
}
export const recognizedScreenText=data=>cleanScreenText(recognizedScreenLines(data).join(' '));
export function screenRecord(row){
  if(!row||!globalThis.__recallWebPolicy.ownerId(row.videoId)||!Number.isFinite(row.start)||row.start<0||row.start>86400*30)throw Error('Invalid saved on-screen text.');
  const text=cleanScreenText(row.text);if((text.match(/\p{L}/gu)||[]).length<3)return null;
  const date=Number(row.indexedAt),now=Date.now();
  const observedLines=cleanScreenLines(row.observedLines);
  return {key:`${row.videoId}:${Math.floor(row.start/SCREEN_INTERVAL)}`,videoId:row.videoId,start:row.start,text,...(observedLines.length?{observedLines}:{}),indexedAt:Number.isFinite(date)&&date>0&&date<=now+60000?date:now};
}
