import {dot,watchedWithin} from './search.js';
import {validateVideoImage} from './video-image.js';
import './scene-policy.js';
import './web-policy.js';
export const SCENE_INTERVAL = globalThis.__recallScenePolicy.BASELINE_MS/1000;
export const SCENES_PER_VIDEO = 240;
export const IMAGES_PER_PAGE = 3;
export const SCENES_TOTAL = 20000;
export const SCENE_MIN_SCORE = 0.26;
export const SCENE_BYTES_TOTAL = 240 * 1024 * 1024;
// Image storage choices in MiB. The image count scales with the size, as at the 240 MiB default.
export const SCENE_STORAGE_CHOICES = [120, 240, 500, 1024];
export function sceneCaps(mb) {
  const size = SCENE_STORAGE_CHOICES.includes(Number(mb)) ? Number(mb) : 240;
  return {bytes: size * 1024 * 1024, count: Math.round(SCENES_TOTAL * size / 240)};
}

// Only small JPEG snapshots generated from the current player are accepted.
export function validateScene(scene) {
  if (!scene || !globalThis.__recallWebPolicy.ownerId(scene.video?.videoId) || !Number.isFinite(scene.start) || scene.start < 0 || scene.start > 86400 * 30) throw new Error('Invalid scene timestamp or video.');
  validateVideoImage(scene.image,{width:320,height:320});
  if(scene.articleImage===true){
    if(scene.video.kind!=='page'||!globalThis.__recallWebPolicy.webId(scene.video.videoId)||!/^[a-f0-9]{64}$/.test(scene.imageId)||typeof scene.caption!=='string'||scene.caption.length>600)throw Error('Invalid article image.');
    return {...scene,start:0,adaptive:false,key:`${scene.video.videoId}:image:${scene.imageId}`};
  }
  const adaptive=scene.adaptive===true;
  return {...scene,adaptive,key:adaptive?`${scene.video.videoId}:change:${Math.floor(scene.start*2)}`:`${scene.video.videoId}:${Math.floor(scene.start / SCENE_INTERVAL)}`};
}

// CLIP vectors have their own space and scores; never compare them to MiniLM.
export function rankScenes(query, scenes, videos, {limit=12,perVideo=2,offset=0,sinceMs=0,untilMs=0}={}) {
  const hits = scenes.filter(scene => scene.vec?.length === query.length && videos.has(scene.videoId))
    .filter(scene => watchedWithin(videos.get(scene.videoId),{sinceMs,untilMs}))
    .map(scene => ({scene,score:dot(query,scene.vec)})).filter(hit => Number.isFinite(hit.score) && hit.score >= SCENE_MIN_SCORE)
    .sort((a,b) => b.score-a.score || a.scene.key.localeCompare(b.scene.key));
  const counts = new Map(), results = [];let skipped = 0;
  for (const {scene,score} of hits) {
    const count = counts.get(scene.videoId) || 0;if (count >= perVideo) continue;
    counts.set(scene.videoId,count+1);if (skipped++ < offset) continue;
    const video = videos.get(scene.videoId);
    results.push({videoId:scene.videoId,...(video.kind?{kind:video.kind,url:video.url,itemId:scene.videoId,mediaKey:video.mediaKey}:{}),title:video.title,channel:video.channel,watchedAt:video.watchedAt,indexedAt:scene.indexedAt,start:scene.start,scene:true,...(scene.articleImage?{articleImage:true,caption:scene.caption,imageId:scene.imageId,matchSources:['Article image']}:{ }),key:scene.key,score});
    if (results.length >= limit) break;
  }
  return results;
}

// Reciprocal-rank fusion avoids treating CLIP and MiniLM cosine values as equal.
export function fuseMatches(words,scenes,{limit=12,perVideo=2,offset=0}={}) {
  const moments=[];
  for (const [source,hits] of [['words',words],['scenes',scenes.filter(hit=>Number.isFinite(hit.score)&&hit.score>=SCENE_MIN_SCORE)]]) {
    hits.forEach((hit,index)=>{
      const label=source==='scenes'?(hit.articleImage?'Article image':'Scene'):hit.matchSources?.[0]||(hit.screenText?'On-screen text':hit.titleOnly?'Title':hit.speechGenerated?'Audio':'Transcript');
      let moment=hit.articleImage?moments.find(m=>m.hit.videoId===hit.videoId&&!m.sources.has(source)):moments.find(m=>m.hit.videoId===hit.videoId && !m.sources.has(source) && !m.hit.titleOnly && !hit.titleOnly && !m.hit.pageText && !hit.pageText && !m.hit.articleImage && !hit.articleImage && Math.abs(m.hit.start-hit.start)<15);
      if (!moment) {moment={hit,sources:new Set(),labels:[],rank:0,priority:source==='words'&&!hit.titleOnly&&hit.score>=0.45?2:source==='scenes'?1:0};moments.push(moment);}
      moment.sources.add(source);moment.labels.push(label);moment.rank+=1/(60+index+1);
      if (source==='scenes') {
        moment.hit={...moment.hit,image:hit.image,key:hit.key,sceneStart:hit.start,...(hit.articleImage?{articleImage:true,caption:hit.caption,imageId:hit.imageId}:{})};
        if (!hit.articleImage && !moment.hit.titleOnly && moment.hit.score<0.45) moment.hit={...hit};
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
