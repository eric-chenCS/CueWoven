import {SCREEN_PER_VIDEO,SCREEN_TOTAL,SCREEN_RECENT_ROWS} from './screen-text.js';
import {normalizedPassage} from './search.js';
export function screenStorage(open,result,done){
  const range=id=>IDBKeyRange.bound([id,0],[id,Number.MAX_SAFE_INTEGER]);
  async function recount(tx,ids){for(const id of ids){const video=await result(tx.objectStore('videos').get(id));if(video){video.screenCount=await result(tx.objectStore('screenText').index('videoId').count(id));tx.objectStore('videos').put(video);}}}
  return {
    async put(row){
      const database=await open(),tx=database.transaction(['videos','screenText'],'readwrite'),complete=done(tx),store=tx.objectStore('screenText');
      const video=await result(tx.objectStore('videos').get(row.videoId));if(!video){await complete;return {skipped:true};}
      store.put(normalizedPassage(row));const ids=new Set([row.videoId]);
      const own=await result(store.index('videoId').count(row.videoId));
      if(own>SCREEN_PER_VIDEO)for(const key of await result(store.index('videoTime').getAllKeys(range(row.videoId),own-SCREEN_PER_VIDEO)))store.delete(key);
      const count=await result(store.count());
      if(count>SCREEN_TOTAL)for(const key of await result(store.index('indexedAt').getAllKeys(null,count-SCREEN_TOTAL))){const old=await result(store.get(key));ids.add(old.videoId);store.delete(key);}
      await recount(tx,ids);await complete;return {ok:true};
    },
    async recent(videoId){
      const database=await open(),rows=[];
      await new Promise((resolve,reject)=>{
        const request=database.transaction('screenText').objectStore('screenText').index('videoTime').openCursor(range(videoId),'prev');
        request.onerror=()=>reject(request.error);
        request.onsuccess=()=>{const cursor=request.result;if(!cursor||rows.length>=SCREEN_RECENT_ROWS)return resolve();rows.push(cursor.value);cursor.continue();};
      });return rows;
    },
    async all(){const database=await open();return result(database.transaction('screenText').objectStore('screenText').getAll());},
    async prune(before){
      const database=await open(),tx=database.transaction(['videos','screenText'],'readwrite'),complete=done(tx),store=tx.objectStore('screenText'),ids=new Set();
      const keys=await result(store.index('indexedAt').getAllKeys(IDBKeyRange.upperBound(before)));
      for(const key of keys){const row=await result(store.get(key));ids.add(row.videoId);store.delete(key);}
      await recount(tx,ids);await complete;return keys.length;
    },
  };
}
