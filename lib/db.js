// Tiny IndexedDB wrapper. Everything stays in the browser profile on this device.
//   videos: { videoId, title, channel, lengthSeconds, indexedAt, chunkCount, method }
//   chunks: { id (auto), videoId, start, text, vec: Float32Array }
import {sceneStorage} from './scene-db.js';

const DB_NAME = 'recall';
const DB_VERSION = 2;
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('videos')) db.createObjectStore('videos', { keyPath: 'videoId' });
      if (!db.objectStoreNames.contains('chunks')) {
        const s = db.createObjectStore('chunks', { keyPath: 'id', autoIncrement: true });
        s.createIndex('videoId', 'videoId', { unique: false });
      }
      if (!db.objectStoreNames.contains('scenes')) {
        const scenes = db.createObjectStore('scenes', {keyPath: 'key'});
        scenes.createIndex('videoId', 'videoId');scenes.createIndex('indexedAt', 'indexedAt');
      }
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
    for (const chunk of chunks) tx.objectStore('chunks').add(chunk);
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
  if (video) store.put(Object.assign({}, video, {watchedAt: Math.max(video.watchedAt || 0, watchedAt)}));
  await complete;
  return !!video;
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
export async function replaceVideo(video, chunks) {
  const db = await open();
  const tx = db.transaction(['videos', 'chunks'], 'readwrite');
  const complete = done(tx);
  const existing = await result(tx.objectStore('videos').get(video.videoId));
  const cs = tx.objectStore('chunks');
  await deleteChunksOf(cs, video.videoId);
  for (const c of chunks) cs.add(c);
  tx.objectStore('videos').put({...video, ...(existing?.sceneCount ? {sceneCount: existing.sceneCount} : {})});
  await complete;
}

export async function deleteVideo(videoId) {
  const db = await open();
  const tx = db.transaction(['videos', 'chunks', 'scenes'], 'readwrite');
  const complete = done(tx);
  await deleteChunksOf(tx.objectStore('chunks'), videoId);
  await deleteChunksOf(tx.objectStore('scenes'), videoId);
  tx.objectStore('videos').delete(videoId);
  await complete;
}

export async function clearAll() {
  const db = await open();
  const tx = db.transaction(['videos', 'chunks', 'scenes'], 'readwrite');
  tx.objectStore('videos').clear();
  tx.objectStore('chunks').clear();
  tx.objectStore('scenes').clear();
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
  for (const chunk of chunks) cs.add({...chunk, speechStart: rangeStart, speechEnd: rangeEnd});
  const record = {...existing, ...video, method: 'speech-local', partial: true, indexedAt: Date.now(), watchedAt: Math.max(video.watchedAt || 0, existing?.watchedAt || 0), chunkCount: remaining + chunks.length};
  vs.put(record);await complete;
  return {chunkCount: record.chunkCount, video: record};
}
export const scenes = sceneStorage(open, result, done);

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
