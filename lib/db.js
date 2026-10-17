// Tiny IndexedDB wrapper. Everything stays in the browser profile on this device.
//   videos: { videoId, title, channel, lengthSeconds, indexedAt, chunkCount, method }
//   chunks: { id (auto), videoId, start, text, vec: Float32Array }
import {sceneStorage,compressedScene} from './scene-db.js';
import {screenStorage} from './screen-db.js';
import {hasImportExemption} from './retention.js';
import {itemStorage,upgradeWebItems} from './item-db.js';
import {normalizedPassage} from './search.js';
import {policy} from './web-items.js';

const DB_NAME = 'recall';
const DB_VERSION = 5;
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains('items'))db.createObjectStore('items',{keyPath:'id'}).createIndex('contentAt','contentAt');
      if (!db.objectStoreNames.contains('videos')) db.createObjectStore('videos', { keyPath: 'videoId' });
      if (!db.objectStoreNames.contains('chunks')) {
        const s = db.createObjectStore('chunks', { keyPath: 'id', autoIncrement: true });
        s.createIndex('videoId', 'videoId', { unique: false });
      }
      if (!db.objectStoreNames.contains('scenes')) {
        const scenes = db.createObjectStore('scenes', {keyPath: 'key'});
        scenes.createIndex('videoId', 'videoId');scenes.createIndex('indexedAt', 'indexedAt');
      }
      if (!db.objectStoreNames.contains('screenText')) {
        const text=db.createObjectStore('screenText',{keyPath:'key'});
        text.createIndex('videoId','videoId');text.createIndex('indexedAt','indexedAt');text.createIndex('videoTime',['videoId','indexedAt']);
      }
      const images=req.transaction.objectStore('scenes').openCursor();
      images.onsuccess=()=>{const cursor=images.result;if(!cursor)return;if(typeof cursor.value.image==='string')cursor.update(compressedScene(cursor.value));cursor.continue();};
      const tx=req.transaction;
      for(const name of ['chunks','screenText']){
        const rows=tx.objectStore(name).openCursor();
        rows.onsuccess=()=>{const cursor=rows.result;if(!cursor)return;cursor.update(normalizedPassage(cursor.value));cursor.continue();};
      }
      upgradeWebItems(tx).catch(()=>tx.abort());
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const done = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
  });

const result = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function deleteChunksOf(store, videoId) {
  return new Promise((resolve, reject) => {
    const req = store.index('videoId').openKeyCursor(IDBKeyRange.only(videoId));
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return resolve();
      store.delete(cur.primaryKey);
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getVideo(videoId) {
  const db = await open();
  return result(db.transaction('videos').objectStore('videos').get(videoId));
}

// An import must never replace a transcript that finished indexing concurrently.
export async function addVideoIfAbsent(video, chunks) {
  const db = await open();
  const tx = db.transaction(['videos', 'chunks'], 'readwrite');
  const complete = done(tx);
  const store = tx.objectStore('videos');
  const existing = await result(store.get(video.videoId));
  if (!existing) {
    store.add(video);
    for (const chunk of chunks) tx.objectStore('chunks').add(normalizedPassage(chunk));
  }
  await complete;
  return !existing;
}

export async function listVideos() {
  const db = await open();
  const all = await result(db.transaction('videos').objectStore('videos').getAll());
  return all.sort((a, b) => (b.indexedAt || 0) - (a.indexedAt || 0));
}

export async function touchWatch(videoId, watchedAt) {
  const db = await open();
  const tx = db.transaction('videos', 'readwrite');
  const complete = done(tx);
  const store = tx.objectStore('videos');
  const video = await result(store.get(videoId));
  if (video) store.put(Object.assign({}, video, {watchedAt: Math.max(video.watchedAt || 0, watchedAt),historyImported:false}));
  await complete;
  return !!video;
}

// A duplicate Takeout row can repair lost provenance only if no later live watch won.
export async function repairImportOrigin(videoId, watchedAt) {
  const database=await open(),tx=database.transaction('videos','readwrite'),complete=done(tx),store=tx.objectStore('videos');
  const video=await result(store.get(videoId));
  const repair=!!video && video.historyImported===undefined && video.watchedAt===watchedAt;
  if(repair)store.put({...video,historyImported:true});
  await complete;return repair;
}

export async function allChunks() {
  const db = await open();
  return result(db.transaction('chunks').objectStore('chunks').getAll());
}

export async function chunksOf(videoId) {
  const db = await open();
  return result(db.transaction('chunks').objectStore('chunks').index('videoId').getAll(IDBKeyRange.only(videoId)));
}

/** Replace a video's record and all its chunks in one transaction. */
export async function replaceVideo(video, chunks, {backgroundCapture=false}={}) {
  const db = await open();
  const tx = db.transaction(['videos', 'chunks'], 'readwrite');
  const complete = done(tx);
  const existing = await result(tx.objectStore('videos').get(video.videoId));
  const cs = tx.objectStore('chunks');
  await deleteChunksOf(cs, video.videoId);
  for (const c of chunks) cs.add(normalizedPassage(c));
  const record={...video,sceneCount:existing?.sceneCount||0,screenCount:existing?.screenCount||0,watchedAt:Math.max(video.watchedAt||0,existing?.watchedAt||0)||undefined};
  if(backgroundCapture)record.historyImported=hasImportExemption(existing);
  if(existing?.historyImported===false && existing.watchedAt>(video.watchedAt||0))record.historyImported=false;
  tx.objectStore('videos').put(record);
  await complete;
  return record;
}

export async function deleteVideo(videoId) {
  if(policy.webId(videoId))return items.delete(videoId);
  const db = await open();
  const tx = db.transaction(['videos', 'chunks', 'scenes', 'screenText','items'], 'readwrite');
  const complete = done(tx);
  await deleteChunksOf(tx.objectStore('chunks'), videoId);
  await deleteChunksOf(tx.objectStore('scenes'), videoId);
  await deleteChunksOf(tx.objectStore('screenText'), videoId);
  tx.objectStore('videos').delete(videoId);
  await complete;
}

export async function clearAll() {
  const db = await open();
  const tx = db.transaction(['videos', 'chunks', 'scenes', 'screenText','items'], 'readwrite');
  tx.objectStore('videos').clear();
  tx.objectStore('chunks').clear();
  tx.objectStore('scenes').clear();
  tx.objectStore('screenText').clear();
  tx.objectStore('items').clear();
  await done(tx);
}
// Append only the newly heard range. Full caption transcripts always win races.
export async function appendSpeechVideo(video, chunks, rangeStart, rangeEnd) {
  const database = await open();
  const tx = database.transaction(['videos', 'chunks'], 'readwrite'), complete = done(tx);
  const vs = tx.objectStore('videos'), cs = tx.objectStore('chunks');
  const existing = await result(vs.get(video.videoId));
  if (existing && !['history-title', 'speech-local'].includes(existing.method)) {await complete;return {skipped: true};}
  const previous = await result(cs.index('videoId').getAll(IDBKeyRange.only(video.videoId)));
  let remaining = 0;
  for (const chunk of previous) {
    if (existing?.method !== 'speech-local' || (chunk.speechStart ?? chunk.start) < rangeEnd && (chunk.speechEnd ?? chunk.start + 30) > rangeStart) cs.delete(chunk.id);
    else remaining++;
  }
  for (const chunk of chunks) cs.add(normalizedPassage({...chunk, speechStart: rangeStart, speechEnd: rangeEnd}));
  const record = {...existing, ...video, method: 'speech-local',historyImported:false, partial: true, indexedAt: Date.now(), watchedAt: Math.max(video.watchedAt || 0, existing?.watchedAt || 0), chunkCount: remaining + chunks.length};
  vs.put(record);await complete;
  return {chunkCount: record.chunkCount, video: record};
}
export const scenes = sceneStorage(open, result, done);
export const screenText = screenStorage(open, result, done);
export const items = itemStorage(open,result,done);

// Compare current chunk identities/text before replacing vectors. Deletion,
// transcript replacement and live speech updates must win a migration race.
export async function updateEmbeddings(expected,vectors,embeddingVersion) {
  const database=await open(),tx=database.transaction(['videos','chunks'],'readwrite'),complete=done(tx),store=tx.objectStore('chunks');
  let updated=0;const parents=new Map();
  for(let i=0;i<expected.length;i++){
    const old=expected[i],current=await result(store.get(old.id));
    if(!parents.has(old.videoId))parents.set(old.videoId,await result(tx.objectStore('videos').get(old.videoId)));
    const video=parents.get(old.videoId);
    if(!video || !current || current.videoId!==old.videoId || current.text!==old.text || current.start!==old.start)continue;
    if(current.embeddingVersion===embeddingVersion)continue;
    store.put({...current,vec:vectors[i],embeddingVersion});updated++;
  }
  await complete;return updated;
}
