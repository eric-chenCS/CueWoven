import {validateVideoImage} from './video-image.js';
export const SCREEN_INTERVAL=5,SCREEN_PER_VIDEO=720,SCREEN_TOTAL=10000;
export function validateScreenFrame(frame){
  if(!frame || !/^[\w-]{11}$/.test(frame.video?.videoId) || !Number.isFinite(frame.start)||frame.start<0||frame.start>86400*30)throw Error('Invalid on-screen text video or timestamp.');
  validateVideoImage(frame.image,{width:1280,height:720,chars:1500000});return frame;
}
export function cleanScreenText(text){return String(text||'').replace(/[\p{Cc}\p{Cf}]/gu,' ').replace(/\s+/g,' ').trim().slice(0,2000);}
// Low-confidence fragments from scenery must not become searchable words.
export function recognizedScreenLines(data){
  const lines=[];
  for(const block of data?.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[]){
    if(!Number.isFinite(line.confidence)||line.confidence<65)continue;
    const text=cleanScreenText((line.words||[]).filter(word=>word.confidence>=65).map(word=>word.text).join(' '));
    if((text.match(/\p{L}/gu)||[]).length<3)continue;
    if(!lines.some(existing=>existing.toLowerCase().includes(text.toLowerCase())))lines.push(text);
  }
  return lines;
}
export const recognizedScreenText=data=>cleanScreenText(recognizedScreenLines(data).join(' '));
export function screenRecord(row){
  if(!row||!/^[\w-]{11}$/.test(row.videoId)||!Number.isFinite(row.start)||row.start<0||row.start>86400*30)throw Error('Invalid saved on-screen text.');
  const text=cleanScreenText(row.text);if((text.match(/\p{L}/gu)||[]).length<3)return null;
  const date=Number(row.indexedAt),now=Date.now();
  return {key:`${row.videoId}:${Math.floor(row.start/SCREEN_INTERVAL)}`,videoId:row.videoId,start:row.start,text,indexedAt:Number.isFinite(date)&&date>0&&date<=now+60000?date:now};
}
