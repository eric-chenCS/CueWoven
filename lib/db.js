// Tiny IndexedDB wrapper. Everything stays in the browser profile on this device.
//   videos: { videoId, title, channel, lengthSeconds, indexedAt, chunkCount, method }
//   chunks: { id (auto), videoId, start, text, vec: Float32Array }

const DB_NAME = 'recall';
const DB_VERSION = 1;
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
  const cs = tx.objectStore('chunks');
  await deleteChunksOf(cs, video.videoId);
  for (const c of chunks) cs.add(c);
  tx.objectStore('videos').put(video);
  await done(tx);
}

export async function deleteVideo(videoId) {
  const db = await open();
  const tx = db.transaction(['videos', 'chunks'], 'readwrite');
  await deleteChunksOf(tx.objectStore('chunks'), videoId);
  tx.objectStore('videos').delete(videoId);
  await done(tx);
}

export async function clearAll() {
  const db = await open();
  const tx = db.transaction(['videos', 'chunks'], 'readwrite');
  tx.objectStore('videos').clear();
  tx.objectStore('chunks').clear();
  await done(tx);
}
