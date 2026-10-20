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

// Keep close lexical evidence or the existing strong-text score ahead of image similarity.
export const hasRelevantText = words => words.some(hit => Number.isFinite(hit.score) && (hit.match === 'close' || hit.score >= 0.45));

// Visual scores use a different scale: select a fallback pool instead of blending ranks.
export function fuseMatches(words,scenes,{limit=12,perVideo=2,offset=0}={}) {
  const visuals=scenes.filter(hit=>Number.isFinite(hit.score)&&hit.score>=SCENE_MIN_SCORE);
  const textFirst=hasRelevantText(words)||!visuals.length;
  const hits=textFirst?words:visuals;
  const counts=new Map(),results=[];let skipped=0;
  for (const hit of hits) {
    const n=counts.get(hit.videoId)||0;if(n>=perVideo)continue;
    counts.set(hit.videoId,n+1);if(skipped++<offset)continue;
    const matchSources=hit.matchSources?.length?hit.matchSources:[textFirst?(hit.screenText?'On-screen text':hit.titleOnly?'Title':hit.speechGenerated?'Audio':'Transcript'):(hit.articleImage?'Article image':'Scene')];
    results.push({...hit,matchSources});if(results.length>=limit)break;
  }
  return results;
}
