// Scene storage shares Recall's database so deleting a video removes all its data.
// Database access is supplied by db.js; images are omitted from search metadata.
import {SCENES_PER_VIDEO, SCENES_TOTAL, SCENE_BYTES_TOTAL} from './scenes.js';
export function compressedScene(scene) {
  const {video,...stored}=scene;
  const image=typeof scene.image==='string'?new Blob([Uint8Array.from(atob(scene.image.split(',')[1]),c=>c.charCodeAt(0))],{type:'image/jpeg'}):scene.image;
  return {...stored,image,bytes:image.size+(scene.vec?.byteLength||0)+512};
}
async function publicScene(scene) {
  if(!scene || typeof scene.image==='string')return scene;
  const bytes=new Uint8Array(await scene.image.arrayBuffer());let encoded='';
  for(let i=0;i<bytes.length;i+=8192)encoded+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return {...scene,image:'data:image/jpeg;base64,'+btoa(encoded)};
}
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
      store.put(compressedScene(scene));
      const own = (await result(store.index('videoId').getAll(scene.videoId))).sort((a,b)=>a.indexedAt-b.indexedAt);
      const removed = own.slice(0, Math.max(0, own.length-SCENES_PER_VIDEO)).map(s=>s.key);
      for (const key of removed) store.delete(key);
      const all = await result(store.index('indexedAt').getAll());
      let bytes=all.reduce((n,row)=>n+(row.bytes||compressedScene(row).bytes),0),count=all.length;
      const extra=[];
      for(const row of all){if(count<=SCENES_TOTAL && bytes<=SCENE_BYTES_TOTAL)break;extra.push(row.key);count--;bytes-=row.bytes||compressedScene(row).bytes;}
      for (const key of extra) store.delete(key);
      video.savedAt=Date.now();video.watchedAt = Math.max(video.watchedAt || 0, scene.watchedAt || 0);tx.objectStore('videos').put(video);
      await recount(tx,[scene.key,...removed,...extra]);await complete;return {ok:true};
    },
    async get(key) {const db = await open();return publicScene(await result(db.transaction('scenes').objectStore('scenes').get(key)));},
    async all() {const db = await open();return Promise.all((await result(db.transaction('scenes').objectStore('scenes').getAll())).map(publicScene));},
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
