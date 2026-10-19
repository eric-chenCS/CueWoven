import {warmLexical,lexicalCache} from '../lib/lexical-cache.js';
import {searchIntent,matchesSource,searchWithFallback} from '../lib/search-intent.js';
// Offscreen document: owns the embedding model and the local vector index.
// MV3 service workers can't comfortably run WASM models, so the heavy work lives here.
import { createLiveSpeech, cleanSpeechText } from '../lib/live-speech.js';
import { createSpeechModel } from './speech-model.js';
import {createVisionModel} from './vision-model.js';
import {createOcrModel} from './ocr-model.js';
import {createCaptureHold} from '../lib/capture-hold.js';
import {validateScreenFrame,screenRecord,SCREEN_TOTAL,novelScreenLines,cleanScreenText} from '../lib/screen-text.js';
import {validateScene, rankScenes,sceneCaps, fuseMatches} from '../lib/scenes.js';
import { chunkTranscript } from '../lib/chunk.js';
import { prepareQuery, createPool, addIndex, rankPool, nearTie, watchedWithin } from '../lib/search.js';
import * as db from '../lib/db.js';
import { validateVideoMetadataBatch } from '../lib/video-metadata.js';
import { shouldForgetVideo } from '../lib/retention.js';
import {EMBEDDING_VERSION,embeddingText,createEmbeddingMigration} from '../lib/embedding-migration.js';
import {loadVideoChunks,packIndex} from '../lib/video-index.js';
import {createRevisionCache} from '../lib/revision-cache.js';
import {createQueryCache} from '../lib/query-cache.js';
import {createWebEngine} from './web-engine.js';
import {policy,itemIdentity as webIdentity} from '../lib/web-items.js';
import {samples,sampleFor} from '../lib/samples.js';
import {createTextModel} from './text-model.js';
import {visualBudget} from '../lib/visual-budget.js';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const DIM = 384;
const BATCH = 4;
let indexImportBusy = false;
let modelState = {status: 'idle', progress: 0};
function broadcast(msg) { chrome.runtime.sendMessage(msg).catch(() => {}); }
const textModel = createTextModel(state => {modelState = state; broadcast({type: 'model-status', state});});
const embed = textModel.embed;
// ---------------------------------------------------------------------------
// In-memory index (rebuilt lazily from IndexedDB after any change)
// ---------------------------------------------------------------------------
let lastMigrationUpdate=0;
const metadataUpdates = new Map();
const web=createWebEngine({db,embed,onChange:()=>{queryCache.invalidate({destructive:false});broadcast({type:'index-changed'});}});
const webTasks=new Set();
const captionTasks=new Set();
const migration=createEmbeddingMigration({embed,write:db.updateEmbeddings,onChange:state=>{
  if(state.updated!==undefined&&state.updated!==lastMigrationUpdate){lastMigrationUpdate=state.updated;invalidate(false);broadcast({type:'index-changed'});}
  broadcast({type:'embedding-status',state});
}});
const indexCache=createRevisionCache(async()=>{
  const [videoList,screenText]=await Promise.all([db.listVideos(),db.screenText.all()]);
  const videos=new Map(videoList.filter(v=>!policy.webId(v.videoId)).map(v=>[v.videoId,v]));
  for(const [id,video] of metadataUpdates)if(videos.has(id))videos.set(id,video);
  const {chunks,indexedIds,overflow}=await loadVideoChunks(db,videos);
  for(const [id,video] of metadataUpdates)if(videos.has(id))videos.set(id,video);
  migration.start(videoList,chunks).catch(()=>{});
  const usable=[...chunks,...screenText.map(c=>({...c,kind:'screen-text'}))].filter(c=>c.vec?.length===DIM&&(videos.has(c.videoId)||policy.webId(c.videoId)));
  const index=packIndex(usable);
  await warmLexical(index.meta);
  return {videos,index,indexedIds,overflow};
});
const getIndex=()=>indexCache.get();
const invalidate=(destructive=true)=>{indexCache.invalidate({destructive});queryCache.invalidate({destructive});if(destructive){metadataUpdates.clear();lexicalCache.clear();}};
async function refreshVideo(id) {
  if (policy.webId(id)) await web.refresh(id);
  else {
    const video = await db.getVideo(id);
    if (video) { metadataUpdates.set(id, video); indexCache.update(snapshot => snapshot.videos.set(id, video)); }
  }
  queryCache.invalidate({destructive:false});
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------
function cleanVideo(v) {
  return {
    videoId: String(v.videoId),
    ...(v.sample===true&&sampleFor(v.videoId)?{sample:true}:{}),
    ...(Number.isFinite(v.savedAt)&&v.savedAt>0&&v.savedAt<=Date.now()?{savedAt:v.savedAt}:{}),
    title: policy.redactText(v.title).slice(0, 300),
    channel: policy.redactText(v.channel).slice(0, 200),
    lengthSeconds: Number(v.lengthSeconds) || 0,
    ...(typeof v.historyImported==='boolean'?{historyImported:v.historyImported}:{}),
    watchedAt: Number.isFinite(v.watchedAt) && v.watchedAt > 0 ? v.watchedAt : undefined,
  };
}

async function storeChunks(video, chunks, method, indexedAt) {
  chunks = chunks.map(row=>({...row,text:policy.redactText(row.text)}));
  const vecs = await embed(chunks.map(c=>embeddingText({...video,method},c.text)));
  const existing = await db.getVideo(video.videoId);
  const record = Object.assign(cleanVideo(video), { indexedAt: indexedAt || Date.now(), savedAt:indexedAt===undefined?Date.now():video.savedAt||indexedAt, chunkCount: chunks.length, method: method || null });
  if (method === 'speech-local') record.partial = true;
  record.watchedAt = Math.max(record.watchedAt || 0, existing?.watchedAt || 0) || undefined;
  if(indexedAt===undefined && video.watchedAt>0)record.historyImported=false;
  const saved=await db.replaceVideo(
    record,
    chunks.map((c, i) => ({ ...c, videoId: record.videoId, vec: vecs[i],embeddingVersion:EMBEDDING_VERSION })),
    {backgroundCapture:indexedAt===undefined && !(video.watchedAt>0)}
  );
  invalidate(false);
  return { chunkCount: chunks.length, video: saved };
}

async function importHistory({ videos, historyImported=true }) {
  const batch = validateVideoMetadataBatch(videos).map(cleanVideo);
  const pending = [];let repaired=0;
  for (const video of batch) {
    if (!await db.getVideo(video.videoId)) pending.push(video);
    else if(historyImported && await db.repairImportOrigin(video.videoId,video.watchedAt))repaired++;
  }
  if(repaired)invalidate(false);
  if (!pending.length) return { imported: 0, skipped: batch.length,repaired };
  const vecs = await embed(pending.map(v => `${v.title}. ${v.channel}`));
  let imported = 0;
  for (const [i, v] of pending.entries()) {
    const record = {...cleanVideo(v), indexedAt: Date.now(), savedAt:Date.now(),chunkCount: 1, method: 'history-title',historyImported};
    const added = await db.addVideoIfAbsent(record, [{videoId:v.videoId, start:0, text:v.title, vec:vecs[i],embeddingVersion:EMBEDDING_VERSION}]);
    if (added) { imported++; invalidate(false); }
  }
  return { imported, skipped: batch.length - imported,repaired };
}

async function indexVideo({ video, segments, method }) {
  if(!/^[\w-]{11}$/.test(video?.videoId))throw Error('Invalid YouTube video identity.');
  const chunks = chunkTranscript(segments);
  if (!chunks.length) throw new Error('Transcript was empty');
  return storeChunks(video, chunks, method);
}

const queryCache=createQueryCache(async(key,page)=>rankSearch({...JSON.parse(key),...page}));
async function search({query,limit=12,perVideo=2,sinceDays,sinceMs=0,untilMs=0,exclude=[],offset=0,kind='all',videoId,inferFilters=true}){
  if(![sinceMs,untilMs].every(ms=>Number.isSafeInteger(ms)&&ms>=0))throw Error('Invalid date range.');
  if(!Array.isArray(exclude)||exclude.length>100||!exclude.every(id=>policy.ownerId(id)))throw Error('Invalid hidden results.');
  exclude=[...new Set(exclude)].sort();
  const custom=sinceMs||untilMs?{sinceMs,untilMs}:null;
  const intent=searchIntent(query,{sinceDays,infer:inferFilters,manualRange:!!custom});
  const q=intent.query;
  if(!q&&!intent.source&&!intent.sinceDays&&!intent.range&&!custom)return {results:[],appliedFilters:[]};
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>512||![1,2,3,4,5].includes(perVideo))throw Error('Invalid search page.');
  if(videoId!==undefined&&!policy.ownerId(videoId))throw Error('Invalid video filter.');
  // A date range chosen in the popup survives relaxing typed filters; a typed one does not.
  const keyFor=filters=>JSON.stringify({query:q,videoId,perVideo,sinceDays:filters.sinceDays||0,...(filters.range||custom||{}),exclude,kind,source:filters.source});
  // Only an empty first page relaxes inferred filters; reaching the last page does not.
  const first=offset?await queryCache.get(keyFor(intent),0,1):null;
  const result=await searchWithFallback(intent,sinceDays,async filters=>{
    if(offset&&filters===intent&&first.results.length===0)return first;
    const page=await queryCache.get(keyFor(filters),offset,limit);
    return offset&&filters===intent?{...page,hasFirst:true}:page;
  });
  const results=(await Promise.all(result.results.map(async hit=>hit.key?{...hit,image:(await db.scenes.get(hit.key))?.image}:hit))).filter(hit=>!hit.scene||hit.image);
  // Decided here, on the exact page being returned, from comparable scores only (see nearTie).
  return {...result,results,appliedFilters:result.intent.labels,appliedSinceDays:result.intent.sinceDays,filtersRelaxed:result.relaxed,nearTie:!!q&&offset===0&&nearTie(results)};
}
async function rankSearch({ query, limit=12, perVideo=2, sinceDays, sinceMs=0, untilMs=0, exclude=[], offset=0,kind='all',videoId,source='' }) {
  const q = String(query || '').trim();
  if (!q&&!source&&!sinceDays&&!sinceMs&&!untilMs) return { results: [] };
  if(!['all','video','page','search'].includes(kind))throw Error('Invalid result filter.');
  const { videos:youtube, index,indexedIds,overflow } = await getIndex(),metadata=await web.metadata(),hidden=new Set(exclude);
  // Items hidden with "Not this one" leave this map, so YouTube, image and title results skip them.
  const videos=new Map([...youtube,...metadata].filter(([id,v])=>!hidden.has(id)&&matchesSource(v,source)&&(!videoId||id===videoId)&&(kind==='all'||(v.kind||'video')===kind)));
  const range={sinceMs:sinceMs||(sinceDays?Date.now()-sinceDays*864e5:0),untilMs};
  if(!q) {
    const recent=[...videos.values()].filter(v=>watchedWithin(v,range)).sort((a,b)=>(b.watchedAt||b.indexedAt||0)-(a.watchedAt||a.indexedAt||0));
    return {results:recent.slice(offset,offset+limit).map(v=>({...v,start:0,text:v.title,titleOnly:true,matchSources:['Title'],score:0,match:'related'}))};
  }
  const hasScenes = [...videos.values()].some(video=>video.sceneCount>0);
  if (!index.meta.length && !hasScenes && !metadata.size) return { results: [], empty: true };
  const [qv] = await embed([q], {priority:'query'});
  // One ranking pool for every source, so word weights come from the whole library
  // (YouTube, websites, Reels/TikTok and older batches) and all scores share one scale.
  const pool=createPool(prepareQuery(q));
  addIndex(pool,qv,index,videos,range);
  await web.collect(pool,qv,{...range,kind,videoId,source,hidden});
  if(overflow)await db.scanChunks(rows=>{
    const batch=rows.filter(row=>!indexedIds.has(row.id)&&videos.has(row.videoId)&&row.vec?.length===DIM);
    addIndex(pool,qv,packIndex(batch),videos,range);
  });
  const words=rankPool(pool,{perVideo});
  const select=hits=>{const count=new Map();return hits.filter(hit=>{const n=count.get(hit.videoId)||0;count.set(hit.videoId,n+1);return n<perVideo;}).slice(offset,offset+limit);};
  const finish=results=>({results});
  if(!hasScenes)return finish(select(words));
  try {
    const visual = await visualBudget(searchScenes(q,{limit:2000,perVideo,...range},videos));
    if (!visual.results.length) return {...finish(select(words)),visualPending:!!visual.pending};
    return finish(fuseMatches(words,visual.results,{limit,perVideo,offset}));
  } catch (error) {
    return {...finish(select(words)),sceneError:'Scene search unavailable: '+error.message};
  }
}

async function status() {
  const videos = await db.listVideos();
  const chunks = videos.reduce((n, v) => n + (v.method === 'history-title' ? 0 : v.chunkCount || 0), 0);
  const screenText=videos.reduce((n,v)=>n+(v.screenCount||0),0);
  return { total:videos.length,videos:videos.filter(v=>!v.kind||v.kind==='video').length,pages:videos.filter(v=>v.kind==='page').length,searches:videos.filter(v=>v.kind==='search').length,chunks:chunks+screenText, screenText, scenes: videos.reduce((n,v)=>n+(v.sceneCount || 0),0), model: modelState,embeddingMigration:migration.status() };
}

async function exportIndex() {
  const videos = await db.listVideos();
  const out = [];
  const items=[];
  for (const v of videos) {
    if(policy.webId(v.videoId)){items.push({...v,passages:(await db.items.get(v.videoId))?.passages.filter(row=>!['Title','Search'].includes(row.source)).map(({start,text,source,anchor,speechStart,speechEnd})=>({start,text,source,...(anchor?{anchor}:{}),...(Number.isFinite(speechStart)?{speechStart,speechEnd}:{})}))||[]});continue;}
    const chunks = (await db.chunksOf(v.videoId)).sort((a, b) => a.start - b.start);
    out.push(Object.assign({}, v, { chunks: chunks.map((c) => ({ start: c.start, text: c.text, ...(Number.isFinite(c.speechStart) ? {speechStart: c.speechStart, speechEnd: c.speechEnd} : {}) })) }));
  }
  const scenes = (await db.scenes.all()).map(({videoId,start,image,indexedAt,adaptive,articleImage,caption,imageId})=>({videoId,start,image,indexedAt,...(adaptive?{adaptive:true}:{}),...(articleImage?{articleImage,caption,imageId}:{})}));
  const screenText=(await db.screenText.all()).map(({videoId,start,text,indexedAt,observedLines})=>({videoId,start,text,indexedAt,...(observedLines?{observedLines}:{})}));
  return { format: 'recall-export', version: 2, model: MODEL_ID, embeddingVersion:EMBEDDING_VERSION,exportedAt: new Date().toISOString(), videos: out, items,scenes,screenText };
}

// Backups store text/images and re-embed here so vectors survive model changes.
async function importIndex({ data,sceneStorageMB }) {
  if (indexImportBusy) throw new Error('An index import is already running.');
  indexImportBusy = true;
  try {return await restoreIndex(data,sceneStorageMB);} finally {indexImportBusy = false;}
}
async function restoreIndex(data,sceneStorageMB) {
  if (!data || data.format !== 'recall-export' || !Array.isArray(data.videos)) throw new Error('Not a CueWoven export file');
  let imported = 0;
  if(data.items!==undefined&&!Array.isArray(data.items))throw Error('Invalid web-history backup.');
  for(const item of data.items||[]){await web.restore(item);imported++;}
  for (const v of data.videos) {
    if (!v || typeof v.videoId !== 'string' || !/^[\w-]{11}$/.test(v.videoId) || !Array.isArray(v.chunks)) continue;
    const chunks = v.chunks
      .filter((c) => c && typeof c.text === 'string' && c.text.trim())
      .map((c) => ({ start: Number(c.start) || 0, text: c.text.slice(0, 2000), ...(Number.isFinite(c.speechStart) && c.speechStart >= 0 && Number.isFinite(c.speechEnd) && c.speechEnd > c.speechStart && c.speechEnd - c.speechStart <= 180 ? {speechStart: c.speechStart, speechEnd: c.speechEnd} : {}) }));
    if (!chunks.length) continue;
    await storeChunks(v, chunks, v.method || 'import', Number(v.indexedAt) || Date.now());
    imported++;
    broadcast({ type: 'import-progress', done: imported, total: data.videos.length });
  }
  if (Array.isArray(data.scenes)) {
    for (const scene of data.scenes.slice(-sceneCaps(sceneStorageMB).count)) {
      const video = await db.getVideo(scene?.videoId);if (!video) continue;
      const valid = validateScene({...scene,video});
      const vec = await visionModel.image(valid.image);
      await putScene({...valid,videoId:video.videoId,indexedAt:Number(scene.indexedAt)||Date.now(),watchedAt:video.watchedAt,vec},sceneStorageMB);
    }
    invalidate();
  }
  if(Array.isArray(data.screenText)){
    const rows=data.screenText.slice(-SCREEN_TOTAL).map(screenRecord).filter(Boolean);
    for(let i=0;i<rows.length;i+=BATCH){
      const batch=rows.slice(i,i+BATCH),vectors=await embed(batch.map(row=>row.text));
      for(const [j,row] of batch.entries())await db.screenText.put({...row,vec:vectors[j],embeddingVersion:EMBEDDING_VERSION});
    }
    invalidate();
  }
  web.reset();return { imported };
}

async function prune({ maxAgeDays,importMaxAgeDays=0,sceneStorageMB }) {
  const scenesTrimmed = sceneStorageMB===undefined ? 0 : await db.scenes.trim(sceneCaps(sceneStorageMB));
  if (scenesTrimmed) invalidate();
  if (!maxAgeDays&&!importMaxAgeDays) return { removed: 0,scenesTrimmed };
  const old = (await db.listVideos()).filter(v => shouldForgetVideo(v,maxAgeDays,Date.now(),importMaxAgeDays));
  for (const v of old) await db.deleteVideo(v.videoId);
  if (old.length) {invalidate();web.reset();}
  const scenesRemoved = maxAgeDays?await db.scenes.prune(Date.now()-maxAgeDays*864e5):0;
  if (scenesRemoved) invalidate();
  const screenRemoved=maxAgeDays?await db.screenText.prune(Date.now()-maxAgeDays*864e5):0;
  if(screenRemoved)invalidate();
  return { removed: old.length, scenesRemoved,screenRemoved,scenesTrimmed };
}

let screenTask=null,screenEpoch=0,sceneEpoch=0;
const visualQueries=new Set();
const ocrModel=createOcrModel(state=>broadcast({type:'ocr-state',state}));
const captureHold=createCaptureHold({pending:()=>[screenTask,sceneTask,...visualQueries,...webTasks,...captionTasks],cancel:()=>{screenEpoch++;sceneEpoch++;web.cancel();ocrModel.release();}});
// Set when the visual cap removes old snapshots before the Forget setting would.
let sceneStorageFull=false;
// Without a known size, never remove images early; the next prune applies the chosen size.
async function putScene(row,sceneStorageMB){const response=await db.scenes.put(row,sceneStorageMB===undefined?{count:Infinity,bytes:Infinity}:sceneCaps(sceneStorageMB));if(response?.evicted)sceneStorageFull=true;return response;}
function libraryChange(work,options){
  return captureHold.run(async()=>{
    sceneStorageFull=false;invalidate();web.reset();
    try{return await work();}
    finally{invalidate();web.reset();}
  },options);
}
function webCapture(work){if(captureHold.held()||indexImportBusy)return Promise.resolve({busy:true});const task=Promise.resolve().then(work);webTasks.add(task);return task.finally(()=>webTasks.delete(task));}
async function captionChange(work){if(captureHold.held())throw Error('Wait for the current library change before indexing captions.');const task=Promise.resolve().then(work);captionTasks.add(task);try{return await task;}finally{captionTasks.delete(task);}}
function visualQuery(work){
  if(captureHold.held() || indexImportBusy)return Promise.reject(Error('Wait for the library change to finish before searching scenes.'));
  const task=Promise.resolve().then(work);visualQueries.add(task);
  return task.finally(()=>visualQueries.delete(task));
}
async function indexScreen(input){
  const frame=validateScreenFrame(input);
  if(captureHold.held() || screenTask || sceneTask || visualQueries.size || indexImportBusy)return {busy:true};
  const epoch=screenEpoch;
  screenTask=(async()=>{
    const blob=new Blob([Uint8Array.from(atob(frame.image.split(',')[1]),c=>c.charCodeAt(0))],{type:'image/jpeg'});
    const bitmap=await createImageBitmap(blob),width=bitmap.width,height=bitmap.height;bitmap.close();
    const {text,lines}=await ocrModel.read(frame.image,width,height);
    if(epoch!==screenEpoch)return {disabled:true};
    if(!text)return {ok:true,empty:true};
    const id=frame.video.videoId,now=Date.now();
    if(policy.webId(id))await web.ensure(frame.video);else if(!await db.getVideo(id))await importHistory({videos:[{...cleanVideo(frame.video),watchedAt:now}],historyImported:false});
    if(epoch!==screenEpoch)return {disabled:true};
    await db.touchWatch(id,now);
    const recent=await db.screenText.recent(id),observedLines=lines?.length?lines:[text];
    const fresh=cleanScreenText(policy.redactText(novelScreenLines(observedLines,recent,frame.start).join(' ')));
    if(!fresh)return {ok:true,duplicate:true};
    const [vec]=await embed([fresh]);
    if(epoch!==screenEpoch)return {disabled:true};
    const row=screenRecord({videoId:id,start:frame.start,text:fresh,observedLines:observedLines.map(policy.redactText),indexedAt:now});
    const response=await db.screenText.put({...row,vec,embeddingVersion:EMBEDDING_VERSION});
    if(policy.webId(id))await web.refresh(id);invalidate(false);broadcast({type:'index-changed'});return response;
  })();
  try{return await screenTask;}catch(error){if(epoch!==screenEpoch)return {disabled:true};throw error;}finally{screenTask=null;}
}

let visionState = {status:'idle'}, sceneTask = null;
const extraSceneBudget=globalThis.__recallScenePolicy.createBudget();
const visionModel = createVisionModel(state=>{visionState=state;broadcast({type:'vision-state',state});});
async function indexScene(input) {
  const scene = validateScene(input);
  if (captureHold.held() || sceneTask || screenTask || visualQueries.size || indexImportBusy) return {busy:true};
  const now=Date.now();
  if(scene.adaptive){
    if(!extraSceneBudget.allows(now))return {rateLimited:true,retryAfterMs:extraSceneBudget.retryAfter(now)};
    extraSceneBudget.record(now);
  }
  const epoch=sceneEpoch;
  sceneTask = (async()=>{
    const vec = await visionModel.image(scene.image);
    if(epoch!==sceneEpoch)return {disabled:true};
    if(scene.articleImage){if(!await db.getVideo(scene.video.videoId))return {disabled:true};}
    else if(policy.webId(scene.video.videoId))await web.ensure(scene.video);else if(!await db.getVideo(scene.video.videoId))await importHistory({videos:[{...cleanVideo(scene.video),watchedAt:Date.now()}],historyImported:false});
    if(epoch!==sceneEpoch)return {disabled:true};
    await db.touchWatch(scene.video.videoId,Date.now());
    if(epoch!==sceneEpoch)return {disabled:true};
    if(scene.articleImage&&scene.caption)await web.imageCaption(scene.video,scene.caption);
    if(epoch!==sceneEpoch)return {disabled:true};
    const response = await putScene({key:scene.key,videoId:scene.video.videoId,start:scene.start,image:scene.image,adaptive:scene.adaptive,...(scene.articleImage?{articleImage:true,caption:scene.caption,imageId:scene.imageId}:{}),vec,indexedAt:Date.now(),watchedAt:Date.now()},input.sceneStorageMB);
    await refreshVideo(scene.video.videoId);broadcast({type:'index-changed'});return response;
  })();
  try {return await sceneTask;} catch(error){if(epoch!==sceneEpoch)return {disabled:true};throw error;} finally {sceneTask = null;}
}
async function indexArticleImage({url,image,caption,sceneStorageMB}){
  const identity=await webIdentity(url),video=await db.getVideo(identity.videoId);
  if(!video||video.kind!=='page')return {disabled:true};
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(image));
  const imageId=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  const scene=validateScene({video,start:0,image,caption,articleImage:true,imageId});
  if(await db.scenes.get(scene.key))return {duplicate:true};
  return indexScene({...scene,sceneStorageMB});
}
function searchScenes(query,options,records) {
  if(sceneTask)return Promise.resolve({results:[],pending:true});
  return visualQuery(async()=>{
    const scenes = await db.scenes.vectors();
    if (!scenes.length) return {results:[],empty:true};
    const vector = await visionModel.text(query);
    const videos = records||new Map((await db.listVideos()).map(video=>[video.videoId,video]));
    const hits = rankScenes(vector,scenes,videos,options);
    return {results:hits};
  });
}


async function appendSpeech({video, segments, rangeStart, rangeEnd}) {
  if (!video || !policy.ownerId(video.videoId) || !Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeStart < 0 || rangeEnd <= rangeStart || rangeEnd - rangeStart > 180 || !Array.isArray(segments) || segments.length > 1000) throw new Error('Invalid speech transcript.');
  if(policy.webId(video.videoId))return webCapture(()=>web.media(video,segments.filter(s=>Number.isFinite(s.start)&&s.start>=rangeStart&&s.start<=rangeEnd).map(s=>({...s,text:cleanSpeechText(s.text)})),'Audio',[rangeStart,rangeEnd]));
  const existing = await db.getVideo(video.videoId);
  if (existing && !['history-title', 'speech-local'].includes(existing.method)) return {skipped: true};
  const chunks = chunkTranscript(segments.filter(s => Number.isFinite(s.start) && s.start >= rangeStart && s.start <= rangeEnd).map(s => ({...s, text: policy.redactText(cleanSpeechText(String(s.text || '').slice(0, 2000)))})));
  if (!chunks.length) return {chunkCount: 0};
  const vecs = await embed(chunks.map(c => embeddingText({...video,method:'speech-local'},c.text)));
  const result = await db.appendSpeechVideo({...cleanVideo(video), watchedAt: Date.now()}, chunks.map((c, i) => ({videoId: video.videoId, start: c.start, text: c.text, vec: vecs[i],embeddingVersion:EMBEDDING_VERSION})), rangeStart, rangeEnd);
  if (!result.skipped) {invalidate(false);broadcast({type: 'index-changed'});}
  return result;
}

const speechModel = createSpeechModel();
const speech = createLiveSpeech({
  prepareModel: speechModel.prepare, transcribe: speechModel.transcribe, releaseModel: speechModel.release,
  openAudio: async () => {
    const {id, tabId} = speech.status();
    const response = await chrome.runtime.sendMessage({type: 'speech-audio-open', id, tabId});
    if (response?.error) throw new Error(response.error);
    return {close: () => chrome.runtime.sendMessage({type: 'speech-audio-close', id, tabId}).catch(() => {})};
  },
  save: appendSpeech,
  readClock: async tabId => {
    const response = await chrome.runtime.sendMessage({type: 'speech-clock', tabId});
    if (response?.error) throw new Error(response.error);
    return response;
  },
  onChange: state => broadcast({type: 'speech-state', state}),
});

async function loadSamples(){
  let imported=0;
  for(const sample of samples){
    if(await db.getVideo(sample.videoId))continue;
    const chunks=sample.lines.map((text,i)=>({text,start:i*8}));
    const vecs=await embed(chunks.map(row=>row.text));
    if(await db.addVideoIfAbsent({...cleanVideo(sample),sample:true,channel:'CueWoven demo',method:'demo',indexedAt:Date.now(),savedAt:Date.now(),chunkCount:chunks.length},chunks.map((row,i)=>({...row,videoId:sample.videoId,vec:vecs[i],embeddingVersion:EMBEDDING_VERSION}))))imported++;
  }
  invalidate(false);broadcast({type:'index-changed'});return {imported};
}
const handlers = {
  'load-samples':()=>captionChange(loadSamples),
  'forget-recent':({hours})=>libraryChange(async()=>{
    if(![1,24,168].includes(hours))throw Error('Choose the last hour, day or week.');
    const since=Date.now()-hours*36e5;
    const rows=(await db.listVideos()).filter(video=>(video.savedAt||video.indexedAt||0)>=since);
    invalidate();web.reset();
    for(const video of rows)await db.deleteVideo(video.videoId);
    invalidate();web.reset();return {removed:rows.length};
  }),
  'web-import':async({items})=>{const result=await webCapture(()=>web.importItems(items));if(result.busy)throw Error('Wait for the current library change to finish.');return result;},
  'web-capture':data=>webCapture(()=>web.capture(data)),
  'web-media':({video,segments})=>webCapture(()=>web.media(video,segments,'Transcript')),
  'web-forget':({domain})=>libraryChange(async()=>{const site=policy.domain(domain);if(!site)throw Error('Invalid site.');let removed=0;for(const video of await db.listVideos())if(video.url?policy.matches(new URL(video.url).hostname,[site]):policy.matches('www.youtube.com',[site])||policy.matches('youtu.be',[site])){await db.deleteVideo(video.videoId);removed++;}web.reset();invalidate();return {removed};}),
  'screen-index':indexScreen,
  'ocr-stop':async()=>{screenEpoch++;ocrModel.release();return {ok:true};},
  'scene-index': indexScene,
  'article-image': indexArticleImage,
  'vision-status': async()=>({...visionState,busy:captureHold.held() || !!sceneTask || !!screenTask || visualQueries.size>0 || indexImportBusy}),
  'vision-stop': async()=>{sceneEpoch++;visionModel.release();return {ok:true};},
  'speech-prepare': data => speech.prepare(data),
  'speech-start': data => speech.start(data),
  'speech-stop': ({reason}) => speech.stop(reason),
  'speech-status': async () => speech.status(),
  'speech-pcm': async ({id, tabId, pcm, clock}) => {
    const state = speech.status();
    if (state.id !== id || state.tabId !== tabId || state.status !== 'recording') return {ignored: true};
    if (typeof pcm !== 'string' || pcm.length > 45000) throw new Error('Invalid speech audio packet.');
    const bytes = Uint8Array.from(atob(pcm), c => c.charCodeAt(0));
    if (bytes.byteLength !== 32000) throw new Error('Invalid speech audio size.');
    const samples = new Int16Array(bytes.buffer), audio = Float32Array.from(samples, s => s / 32768);
    await speech.packet(audio, 16000, clock);return {ok: true};
  },
  ping: async () => ({ ok: true }),
  warmup: async ({scenes=false}) => {
    const visual=scenes?visualQuery(async()=>{const videos=await db.listVideos();return videos.some(video=>video.sceneCount>0)?visionModel.warmup():null;}).catch(()=>null):null;
    await Promise.all([textModel.warmup(),getIndex(),visual]);return {ok:true};
  },
  has: async ({ videoId }) => {
    const video = await db.getVideo(videoId);
    return { has: !!video && !['history-title', 'speech-local'].includes(video.method),content:!!video&&(video.chunkCount>0||video.sceneCount>0||video.screenCount>0),title:video?.title,modelStatus:modelState.status };
  },
  'import-history': data=>captionChange(()=>importHistory(data)),
  'touch-watch': async ({ videoId, watchedAt }) => {
    if (typeof videoId !== 'string' || !/^[\w-]{11}$/.test(videoId) || !Number.isFinite(watchedAt) || watchedAt <= 0 || watchedAt > Date.now() + 60000) throw new Error('Invalid watch timestamp.');
    const updated = await db.touchWatch(videoId, watchedAt);
    if (updated) await refreshVideo(videoId);
    return { updated };
  },
  index: input=>captionChange(()=>indexVideo(input)),
  search,
  status,
  list: async ({sceneStorageMB}) => {const videos=await db.listVideos();return {videos,sceneStorageFull:sceneStorageFull||videos.reduce((n,v)=>n+(v.sceneCount||0),0)>=sceneCaps(sceneStorageMB).count};},
  delete: ({ videoId }) => libraryChange(async()=>{await db.deleteVideo(videoId);web.reset();invalidate();return {ok:true};}),
  clear: () => libraryChange(async()=>{await db.clearAll();web.reset();invalidate();return {ok:true};}),
  export: exportIndex,
  import: data=>libraryChange(()=>importIndex(data),{restore:true}),
  prune: data=>libraryChange(()=>prune(data)),
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.target !== 'offscreen') return false;
  if(_sender.id!==chrome.runtime.id||_sender.tab&&!_sender.url?.startsWith(chrome.runtime.getURL('')))return false;
  const fn = handlers[msg.type];
  if (!fn) return false;
  fn(msg)
    .then((r) => sendResponse(r))
    .catch((e) => sendResponse({ error: String(e && e.message || e) }));
  return true;
});
