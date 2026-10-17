// Offscreen document: owns the embedding model and the local vector index.
// MV3 service workers can't comfortably run WASM models, so the heavy work lives here.
import { createLiveSpeech } from '../lib/live-speech.js';
import { createSpeechModel } from './speech-model.js';
import {createVisionModel} from './vision-model.js';
import {validateScene, rankScenes, fuseMatches} from '../lib/scenes.js';
import { chunkTranscript } from '../lib/chunk.js';
import { rank } from '../lib/search.js';
import * as db from '../lib/db.js';
import { validateHistoryBatch } from '../lib/takeout.js';
import { shouldForgetVideo } from '../lib/retention.js';
import {EMBEDDING_VERSION,embeddingText,createEmbeddingMigration} from '../lib/embedding-migration.js';
import {createRevisionCache} from '../lib/revision-cache.js';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const DIM = 384;
const BATCH = 16;
let indexImportBusy = false;

// Transformers.js is imported lazily so the library, export and delete still work
// (with a clear message) if `pnpm run setup` hasn't been run yet.
async function loadRuntime() {
  let mod;
  try {
    mod = await import('../vendor/transformers.bundle.js');
  } catch (e) {
    throw new Error('Model runtime missing. Run "pnpm run setup" in the recall folder, then reload the extension.');
  }
  const { pipeline, env } = mod;
  // Download the model from the Hugging Face hub once, then use the browser cache (works offline after).
  // The ONNX Runtime WASM files ship inside the extension (vendor/), because MV3 forbids remote code.
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('vendor/');
  env.backends.onnx.wasm.numThreads = 1; // extension pages aren't cross-origin isolated
  return pipeline;
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------
let extractorPromise = null;
let modelState = { status: 'idle', progress: 0 };

function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {}); // nobody listening is fine
}

function setModelState(s) {
  modelState = Object.assign({}, modelState, s);
  broadcast({ type: 'model-status', state: modelState });
}

function getExtractor() {
  if (!extractorPromise) {
    setModelState({ status: 'loading', progress: 0 });
    const files = new Map();
    extractorPromise = loadRuntime().then((pipeline) => pipeline('feature-extraction', MODEL_ID, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p) => {
        if (p.status === 'progress' && p.file) {
          files.set(p.file, { loaded: p.loaded || 0, total: p.total || 0 });
          let loaded = 0;
          let total = 0;
          for (const f of files.values()) { loaded += f.loaded; total += f.total; }
          setModelState({ status: 'loading', progress: total ? loaded / total : 0 });
        }
      },
    }))
      .then((ex) => {
        setModelState({ status: 'ready', progress: 1 });
        return ex;
      })
      .catch((e) => {
        extractorPromise = null;
        setModelState({ status: 'error', error: String(e && e.message || e) });
        throw e;
      });
  }
  return extractorPromise;
}

/** @returns {Promise<Float32Array[]>} one normalized vector per text */
async function embed(texts) {
  const extractor = await getExtractor();
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const tensor = await extractor(batch, { pooling: 'mean', normalize: true });
    const data = tensor.data;
    const dim = tensor.dims[tensor.dims.length - 1];
    for (let b = 0; b < batch.length; b++) out.push(Float32Array.from(data.subarray(b * dim, (b + 1) * dim)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// In-memory index (rebuilt lazily from IndexedDB after any change)
// ---------------------------------------------------------------------------
let lastMigrationUpdate=0;
const migration=createEmbeddingMigration({embed,write:db.updateEmbeddings,onChange:state=>{
  if(state.updated!==undefined&&state.updated!==lastMigrationUpdate){lastMigrationUpdate=state.updated;invalidate();broadcast({type:'index-changed'});}
  broadcast({type:'embedding-status',state});
}});
const indexCache=createRevisionCache(async()=>{
  const [videoList, chunks] = await Promise.all([db.listVideos(), db.allChunks()]);
  migration.start(videoList,chunks).catch(()=>{});
  const videos = new Map(videoList.map((v) => [v.videoId, v]));
  const usable = chunks.filter((c) => c.vec && c.vec.length === DIM && videos.has(c.videoId));
  const matrix = new Float32Array(usable.length * DIM);
  const meta = new Array(usable.length);
  usable.forEach((c, i) => {
    matrix.set(c.vec, i * DIM);
    meta[i] = { videoId: c.videoId, start: c.start, text: c.text };
  });
  return { videos, index: { matrix, dim: DIM, meta } };
});
const getIndex=()=>indexCache.get();
const invalidate=()=>indexCache.invalidate();

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------
function cleanVideo(v) {
  return {
    videoId: String(v.videoId),
    title: String(v.title || '').slice(0, 300),
    channel: String(v.channel || '').slice(0, 200),
    lengthSeconds: Number(v.lengthSeconds) || 0,
    watchedAt: Number.isFinite(v.watchedAt) && v.watchedAt > 0 ? v.watchedAt : undefined,
  };
}

async function storeChunks(video, chunks, method, indexedAt) {
  const vecs = await embed(chunks.map(c=>embeddingText({...video,method},c.text)));
  const existing = await db.getVideo(video.videoId);
  const record = Object.assign(cleanVideo(video), { indexedAt: indexedAt || Date.now(), chunkCount: chunks.length, method: method || null });
  if (method === 'speech-local') record.partial = true;
  record.watchedAt = Math.max(record.watchedAt || 0, existing?.watchedAt || 0) || undefined;
  await db.replaceVideo(
    record,
    chunks.map((c, i) => ({ ...c, videoId: record.videoId, vec: vecs[i],embeddingVersion:EMBEDDING_VERSION }))
  );
  invalidate();
  return { chunkCount: chunks.length, video: record };
}

async function importHistory({ videos }) {
  const batch = validateHistoryBatch(videos);
  const pending = [];
  for (const video of batch) if (!await db.getVideo(video.videoId)) pending.push(video);
  if (!pending.length) return { imported: 0, skipped: batch.length };
  const vecs = await embed(pending.map(v => `${v.title}. ${v.channel}`));
  let imported = 0;
  for (const [i, v] of pending.entries()) {
    const record = {...cleanVideo(v), indexedAt: Date.now(), chunkCount: 1, method: 'history-title'};
    const added = await db.addVideoIfAbsent(record, [{videoId:v.videoId, start:0, text:v.title, vec:vecs[i],embeddingVersion:EMBEDDING_VERSION}]);
    if (added) { imported++; invalidate(); }
  }
  return { imported, skipped: batch.length - imported };
}

async function indexVideo({ video, segments, method }) {
  const chunks = chunkTranscript(segments);
  if (!chunks.length) throw new Error('Transcript was empty');
  return storeChunks(video, chunks, method);
}

async function search({ query, limit, perVideo, sinceDays, offset }) {
  const q = String(query || '').trim();
  if (!q) return { results: [] };
  const { videos, index } = await getIndex();
  const hasScenes = [...videos.values()].some(video=>video.sceneCount>0);
  if (!index.meta.length && !hasScenes) return { results: [], empty: true };
  const [qv] = await embed([q]);
  const sinceMs = sinceDays ? Date.now() - sinceDays * 864e5 : 0;
  if (!hasScenes) return { results: rank(qv, index, videos, { query: q, limit, perVideo, sinceMs, offset }) };
  const words = rank(qv,index,videos,{query:q,limit:index.meta.length,perVideo,sinceMs});
  try {
    const visual = await searchScenes(q,{limit:1000,perVideo,sinceMs});
    if (!visual.results.length) return {results:rank(qv,index,videos,{query:q,limit,perVideo,sinceMs,offset})};
    const combined=fuseMatches(words,visual.results,{limit,perVideo,offset});
    const results=await Promise.all(combined.map(async hit=>hit.key?{...hit,image:(await db.scenes.get(hit.key))?.image}:hit));
    return {results:results.filter(hit=>!hit.scene || hit.image)};
  } catch (error) {
    return {results:rank(qv,index,videos,{query:q,limit,perVideo,sinceMs,offset}),sceneError:'Scene search unavailable: '+error.message};
  }
}

async function status() {
  const videos = await db.listVideos();
  const chunks = videos.reduce((n, v) => n + (v.method === 'history-title' ? 0 : v.chunkCount || 0), 0);
  return { videos: videos.length, chunks, scenes: videos.reduce((n,v)=>n+(v.sceneCount || 0),0), model: modelState,embeddingMigration:migration.status() };
}

async function exportIndex() {
  const videos = await db.listVideos();
  const out = [];
  for (const v of videos) {
    const chunks = (await db.chunksOf(v.videoId)).sort((a, b) => a.start - b.start);
    out.push(Object.assign({}, v, { chunks: chunks.map((c) => ({ start: c.start, text: c.text, ...(Number.isFinite(c.speechStart) ? {speechStart: c.speechStart, speechEnd: c.speechEnd} : {}) })) }));
  }
  const scenes = (await db.scenes.all()).map(({videoId,start,image,indexedAt})=>({videoId,start,image,indexedAt}));
  return { format: 'recall-export', version: 1, model: MODEL_ID, embeddingVersion:EMBEDDING_VERSION,exportedAt: new Date().toISOString(), videos: out, scenes };
}

// Backups store text/images and re-embed here so vectors survive model changes.
async function importIndex({ data }) {
  if (indexImportBusy) throw new Error('An index import is already running.');
  indexImportBusy = true;
  try {return await restoreIndex(data);} finally {indexImportBusy = false;}
}
async function restoreIndex(data) {
  if (sceneTask) await sceneTask.catch(()=>{});
  if (!data || data.format !== 'recall-export' || !Array.isArray(data.videos)) throw new Error('Not a Recall export file');
  let imported = 0;
  for (const v of data.videos) {
    if (!v || typeof v.videoId !== 'string' || !Array.isArray(v.chunks)) continue;
    const chunks = v.chunks
      .filter((c) => c && typeof c.text === 'string' && c.text.trim())
      .map((c) => ({ start: Number(c.start) || 0, text: c.text.slice(0, 2000), ...(Number.isFinite(c.speechStart) && c.speechStart >= 0 && Number.isFinite(c.speechEnd) && c.speechEnd > c.speechStart && c.speechEnd - c.speechStart <= 180 ? {speechStart: c.speechStart, speechEnd: c.speechEnd} : {}) }));
    if (!chunks.length) continue;
    await storeChunks(v, chunks, v.method || 'import', Number(v.indexedAt) || Date.now());
    imported++;
    broadcast({ type: 'import-progress', done: imported, total: data.videos.length });
  }
  if (Array.isArray(data.scenes)) {
    for (const scene of data.scenes.slice(-1000)) {
      const video = await db.getVideo(scene?.videoId);if (!video) continue;
      const valid = validateScene({...scene,video});
      const vec = await visionModel.image(valid.image);
      await db.scenes.put({...valid,videoId:video.videoId,indexedAt:Number(scene.indexedAt)||Date.now(),watchedAt:video.watchedAt,vec});
    }
  }
  return { imported };
}

async function prune({ maxAgeDays }) {
  if (!maxAgeDays) return { removed: 0 };
  const old = (await db.listVideos()).filter(v => shouldForgetVideo(v, maxAgeDays));
  for (const v of old) await db.deleteVideo(v.videoId);
  if (old.length) invalidate();
  const scenesRemoved = await db.scenes.prune(Date.now()-maxAgeDays*864e5);
  if (scenesRemoved) invalidate();
  return { removed: old.length, scenesRemoved };
}

let visionState = {status:'idle'}, sceneTask = null, sceneSearches = 0;
const visionModel = createVisionModel(state=>{visionState=state;broadcast({type:'vision-state',state});});
async function indexScene(input) {
  const scene = validateScene(input);
  if (sceneTask || sceneSearches || indexImportBusy) return {busy:true};
  sceneTask = (async()=>{
    const vec = await visionModel.image(scene.image);
    if (!await db.getVideo(scene.video.videoId)) await importHistory({videos:[{...cleanVideo(scene.video),watchedAt:Date.now()}]});
    const response = await db.scenes.put({key:scene.key,videoId:scene.video.videoId,start:scene.start,image:scene.image,vec,indexedAt:Date.now(),watchedAt:Date.now()});
    invalidate();broadcast({type:'index-changed'});return response;
  })();
  try {return await sceneTask;} finally {sceneTask = null;}
}
async function searchScenes(query,options) {
  if (indexImportBusy) throw new Error('Wait for the index import to finish before searching scenes.');
  sceneSearches++;
  try {
    if (sceneTask) await sceneTask.catch(()=>{});
    const scenes = await db.scenes.vectors();
    if (!scenes.length) return {results:[],empty:true};
    const vector = await visionModel.text(query);
    const videos = new Map((await db.listVideos()).map(video=>[video.videoId,video]));
    const hits = rankScenes(vector,scenes,videos,options);
    return {results:hits};
  } finally {sceneSearches--;}
}


async function appendSpeech({video, segments, rangeStart, rangeEnd}) {
  if (!video || !/^[\w-]{11}$/.test(video.videoId) || !Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeStart < 0 || rangeEnd <= rangeStart || rangeEnd - rangeStart > 180 || !Array.isArray(segments) || segments.length > 1000) throw new Error('Invalid speech transcript.');
  const existing = await db.getVideo(video.videoId);
  if (existing && !['history-title', 'speech-local'].includes(existing.method)) return {skipped: true};
  const chunks = chunkTranscript(segments.filter(s => Number.isFinite(s.start) && s.start >= rangeStart && s.start <= rangeEnd).map(s => ({...s, text: String(s.text || '').slice(0, 2000)})));
  if (!chunks.length) return {chunkCount: 0};
  const vecs = await embed(chunks.map(c => embeddingText({...video,method:'speech-local'},c.text)));
  const result = await db.appendSpeechVideo({...cleanVideo(video), watchedAt: Date.now()}, chunks.map((c, i) => ({videoId: video.videoId, start: c.start, text: c.text, vec: vecs[i],embeddingVersion:EMBEDDING_VERSION})), rangeStart, rangeEnd);
  if (!result.skipped) {invalidate();broadcast({type: 'index-changed'});}
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

const handlers = {
  'scene-index': indexScene,
  'vision-status': async()=>({...visionState,busy:!!sceneTask || sceneSearches>0 || indexImportBusy}),
  'vision-stop': async()=>{visionModel.release();return {ok:true};},
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
  warmup: async () => { await getExtractor(); await getIndex();return { ok: true }; },
  has: async ({ videoId }) => {
    const video = await db.getVideo(videoId);
    return { has: !!video && !['history-title', 'speech-local'].includes(video.method) };
  },
  'import-history': importHistory,
  'touch-watch': async ({ videoId, watchedAt }) => {
    if (typeof videoId !== 'string' || !/^[\w-]{11}$/.test(videoId) || !Number.isFinite(watchedAt) || watchedAt <= 0 || watchedAt > Date.now() + 60000) throw new Error('Invalid watch timestamp.');
    const updated = await db.touchWatch(videoId, watchedAt);
    if (updated) invalidate();
    return { updated };
  },
  index: indexVideo,
  search,
  status,
  list: async () => ({ videos: await db.listVideos() }),
  delete: async ({ videoId }) => { await db.deleteVideo(videoId); invalidate(); return { ok: true }; },
  clear: async () => { await db.clearAll(); invalidate(); return { ok: true }; },
  export: exportIndex,
  import: importIndex,
  prune,
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.target !== 'offscreen') return false;
  const fn = handlers[msg.type];
  if (!fn) return false;
  fn(msg)
    .then((r) => sendResponse(r))
    .catch((e) => sendResponse({ error: String(e && e.message || e) }));
  return true;
});
