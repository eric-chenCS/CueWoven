import {dot} from './search.js';
export const SCENE_INTERVAL = 20;
export const SCENES_PER_VIDEO = 120;
export const SCENES_TOTAL = 1000;

// Only small JPEG snapshots generated from the current player are accepted.
export function validateScene(scene) {
  if (!scene || !/^[\w-]{11}$/.test(scene.video?.videoId) || !Number.isFinite(scene.start) || scene.start < 0 || scene.start > 86400 * 30) throw new Error('Invalid scene timestamp or video.');
  const image = scene.image;
  if (typeof image !== 'string' || image.length > 90000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image)) throw new Error('Invalid scene image.');
  const bytes = Uint8Array.from(atob(image.slice(23)), char => char.charCodeAt(0));
  if (bytes[0] !== 255 || bytes[1] !== 216) throw new Error('Invalid JPEG.');
  let offset = 2, valid = false;
  while (offset + 8 < bytes.length) {
    if (bytes[offset++] !== 255) break;
    const marker = bytes[offset++];
    const length = bytes[offset] * 256 + bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    if ([192,193,194].includes(marker)) {
      const height = bytes[offset + 3] * 256 + bytes[offset + 4], width = bytes[offset + 5] * 256 + bytes[offset + 6];
      valid = width > 0 && height > 0 && width <= 320 && height <= 180;break;
    }
    offset += length;
  }
  if (!valid) throw new Error('Scene images must be at most 320 × 180 pixels.');
  return {...scene, key: `${scene.video.videoId}:${Math.floor(scene.start / SCENE_INTERVAL)}`};
}

// CLIP vectors have their own space and scores; never compare them to MiniLM.
export function rankScenes(query, scenes, videos, {limit=12,perVideo=2,offset=0,sinceMs=0}={}) {
  const hits = scenes.filter(scene => scene.vec?.length === query.length && videos.has(scene.videoId))
    .filter(scene => !sinceMs || (videos.get(scene.videoId).watchedAt || videos.get(scene.videoId).indexedAt || 0) >= sinceMs)
    .map(scene => ({scene,score:dot(query,scene.vec)})).filter(hit => Number.isFinite(hit.score) && hit.score >= 0.22)
    .sort((a,b) => b.score-a.score || a.scene.key.localeCompare(b.scene.key));
  const counts = new Map(), results = [];let skipped = 0;
  for (const {scene,score} of hits) {
    const count = counts.get(scene.videoId) || 0;if (count >= perVideo) continue;
    counts.set(scene.videoId,count+1);if (skipped++ < offset) continue;
    const video = videos.get(scene.videoId);
    results.push({videoId:scene.videoId,title:video.title,channel:video.channel,watchedAt:video.watchedAt,indexedAt:scene.indexedAt,start:scene.start,scene:true,key:scene.key,score});
    if (results.length >= limit) break;
  }
  return results;
}

// Reciprocal-rank fusion avoids treating CLIP and MiniLM cosine values as equal.
export function fuseMatches(words,scenes,{limit=12,perVideo=2,offset=0}={}) {
  const moments=[];
  for (const [source,hits] of [['words',words],['scenes',scenes]]) {
    hits.forEach((hit,index)=>{
      const label=source==='scenes'?'Scene':hit.titleOnly?'Title':hit.speechGenerated?'AI speech':'Transcript';
      let moment=moments.find(m=>m.hit.videoId===hit.videoId && !m.sources.has(source) && !m.hit.titleOnly && !hit.titleOnly && Math.abs(m.hit.start-hit.start)<15);
      if (!moment) {moment={hit,sources:new Set(),labels:[],rank:0,priority:source==='words'&&!hit.titleOnly&&hit.score>=0.45?2:source==='scenes'?1:0};moments.push(moment);}
      moment.sources.add(source);moment.labels.push(label);moment.rank+=1/(60+index+1);
      if (source==='scenes') {
        moment.hit={...moment.hit,image:hit.image,key:hit.key,sceneStart:hit.start};
        if (!moment.hit.titleOnly && moment.hit.score<0.45) moment.hit={...hit};
      }
    });
  }
  moments.sort((a,b)=>b.rank-a.rank || b.priority-a.priority || a.hit.videoId.localeCompare(b.hit.videoId) || a.hit.start-b.hit.start);
  const counts=new Map(),results=[];let skipped=0;
  for (const moment of moments) {
    const n=counts.get(moment.hit.videoId)||0;if(n>=perVideo)continue;
    counts.set(moment.hit.videoId,n+1);if(skipped++<offset)continue;
    results.push({...moment.hit,matchSources:moment.labels});if(results.length>=limit)break;
  }
  return results;
}
