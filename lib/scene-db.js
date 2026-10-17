// Scene storage shares Recall's database so deleting a video removes all its data.
// Database access is supplied by db.js; images are omitted from search metadata.
import {SCENES_PER_VIDEO, SCENES_TOTAL} from './scenes.js';
export function sceneStorage(open, result, done) {
  async function recount(tx, keys) {
    for (const id of new Set(keys.map(key => key.split(':')[0]))) {
      const video = await result(tx.objectStore('videos').get(id));
      if (video) {video.sceneCount = await result(tx.objectStore('scenes').index('videoId').count(id));tx.objectStore('videos').put(video);}
    }
  }
  return {
    async put(scene) {
      const db = await open(), tx = db.transaction(['videos','scenes'],'readwrite'), complete = done(tx);
      const store = tx.objectStore('scenes'), video = await result(tx.objectStore('videos').get(scene.videoId));
      if (!video) {await complete;return {skipped:true};}
      store.put(scene);
      const own = (await result(store.index('videoId').getAll(scene.videoId))).sort((a,b)=>a.indexedAt-b.indexedAt);
      const removed = own.slice(0, Math.max(0, own.length-SCENES_PER_VIDEO)).map(s=>s.key);
      for (const key of removed) store.delete(key);
      const all = await result(store.index('indexedAt').getAllKeys());
      const extra = all.slice(0, Math.max(0, all.length-SCENES_TOTAL));
      for (const key of extra) store.delete(key);
      video.watchedAt = Math.max(video.watchedAt || 0, scene.watchedAt || 0);tx.objectStore('videos').put(video);
      await recount(tx,[scene.key,...removed,...extra]);await complete;return {ok:true};
    },
    async get(key) {const db = await open();return result(db.transaction('scenes').objectStore('scenes').get(key));},
    async all() {const db = await open();return result(db.transaction('scenes').objectStore('scenes').getAll());},
    async vectors() {
      const db = await open(), output = [];
      await new Promise((resolve,reject)=>{
        const request = db.transaction('scenes').objectStore('scenes').openCursor();
        request.onerror = ()=>reject(request.error);
        request.onsuccess = ()=>{const cursor=request.result;if (!cursor) return resolve();const {key,videoId,start,indexedAt,vec}=cursor.value;output.push({key,videoId,start,indexedAt,vec});cursor.continue();};
      });return output;
    },
    async prune(before) {
      const db=await open(),tx=db.transaction(['videos','scenes'],'readwrite'),complete=done(tx),store=tx.objectStore('scenes');
      const keys=await result(store.index('indexedAt').getAllKeys(IDBKeyRange.upperBound(before)));
      for (const key of keys) store.delete(key);
      await recount(tx,keys);await complete;return keys.length;
    },
  };
}
