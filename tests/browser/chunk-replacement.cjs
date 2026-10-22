// Real IndexedDB coverage for bounded range deletion and atomic transcript replacement.
const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const f=await fixture();
 try{
  const result=await f.options.evaluate(async()=>{
   const db=await import(chrome.runtime.getURL('lib/db.js'));
   await db.clearAll();
   const a='replace0001',b='replace0002',now=Date.now();
   const row=(videoId,i)=>({videoId,start:i*18,text:'Observed passage '+i,vec:new Int8Array(384).fill(1),scale:0.01,embeddingVersion:'minilm-l6-v2-body-v2'});
   const video=id=>({videoId:id,title:id,method:'captions',watchedAt:now,indexedAt:now,historyImported:false,chunkCount:1201});
   await db.replaceVideo(video(a),[]);await db.replaceVideo(video(b),[]);
   const request=indexedDB.open('recall'),database=await new Promise((r,j)=>{request.onsuccess=()=>r(request.result);request.onerror=()=>j(request.error);});
   const complete=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});
   const tx=database.transaction(['chunks','scenes','screenText','videos'],'readwrite'),done=complete(tx),chunks=tx.objectStore('chunks');
   // Numeric gaps contain another video's chunks, including gaps across the 500-key boundaries.
   for(let i=0;i<1201;i++){chunks.add(row(a,i));if(i%3===0)chunks.add(row(b,i));}
   // Explicit legacy keys can lie between adjacent auto-increment integer keys.
   chunks.add({...row(b,9999),id:3.5});
   for(const name of ['scenes','screenText'])for(let i=0;i<603;i++){
    tx.objectStore(name).put({key:'record-'+String(i).padStart(4,'0'),videoId:i%2?a:b,start:i,indexedAt:now,text:'On screen '+i});
   }
   tx.objectStore('videos').put({...video(a),sceneCount:301,screenCount:301});await done;
   const beforeOther=await db.chunksOf(b),beforeMedia={};
   for(const name of ['scenes','screenText']){const req=database.transaction(name).objectStore(name).getAll();beforeMedia[name]=await new Promise((r,j)=>{req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error);});}
   const expected=Array.from({length:17},(_,i)=>({...row(a,i),text:'Replacement words '+i}));
   const originalTransaction=IDBDatabase.prototype.transaction;let observed;
   IDBDatabase.prototype.transaction=function(stores,mode,...args){
    const write=originalTransaction.call(this,stores,mode,...args);
    if(mode==='readwrite'&&Array.isArray(stores)&&stores.includes('chunks')){
     IDBDatabase.prototype.transaction=originalTransaction;
     const req=database.transaction('chunks').objectStore('chunks').index('videoId').getAll(IDBKeyRange.only(a));
     observed=new Promise((r,j)=>{req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error);});
    }return write;
   };
   const replacement=await db.replaceVideo({...video(a),watchedAt:now-1000,chunkCount:17},expected);
   const during=await observed,after=await db.chunksOf(a),other=await db.chunksOf(b);
   if(JSON.stringify(other)!==JSON.stringify(beforeOther))throw Error('Replacement changed a neighboring video');
   if(JSON.stringify(during)!==JSON.stringify(after)||after.length!==17||after.some((r,i)=>r.text!==expected[i].text))throw Error('Reader saw partial or incorrect replacement');
   if(replacement.sceneCount!==301||replacement.screenCount!==301||replacement.watchedAt!==now||replacement.historyImported!==false)throw Error('Replacement lost video metadata');
   for(const name of ['scenes','screenText']){
    const req=database.transaction(name).objectStore(name).getAll(),rows=await new Promise((r,j)=>{req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error);});
    if(JSON.stringify(rows)!==JSON.stringify(beforeMedia[name]))throw Error('Transcript replacement changed saved media');
   }
   // A conflicting primary key must roll back both deletion and video metadata.
   let rejected=false;
   try{await db.replaceVideo({...video(a),title:'Must roll back'},[{...row(a,0),id:beforeOther[0].id}]);}catch{rejected=true;}
   if(!rejected||JSON.stringify(await db.chunksOf(a))!==JSON.stringify(after)||(await db.getVideo(a)).title!==a)throw Error('Failed replacement was not atomic');
   await db.deleteVideo(a);
   if(await db.getVideo(a)||(await db.chunksOf(a)).length)throw Error('Deleted video still has transcript rows');
   if(JSON.stringify(await db.chunksOf(b))!==JSON.stringify(beforeOther))throw Error('Deleting one video changed its neighbor');
   for(const name of ['scenes','screenText']){
    const req=database.transaction(name).objectStore(name).getAll(),rows=await new Promise((r,j)=>{req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error);});
    if(JSON.stringify(rows)!==JSON.stringify(beforeMedia[name].filter(r=>r.videoId===b)))throw Error('String-key deletion crossed video boundaries');
   }
   // Exercise several full numeric batches and verify no tail survives.
   await db.replaceVideo(video(a),Array.from({length:1603},(_,i)=>row(a,i)));await db.deleteVideo(a);
   if((await db.chunksOf(a)).length)throw Error('Deletion stopped at a batch boundary');
   database.close();return {pass:true,interleavedTargetRows:1201,neighborRows:beforeOther.length,stringMediaRowsPerStore:603,contiguousRows:1603,checks:['interleaved keys','fractional neighbor keys','500-key boundaries','atomic reads','metadata preservation','constraint-error rollback','string-key media isolation','empty-store deletion']};
  });
  assert.equal(result.pass,true);
  if(process.env.RECALL_REPORT_DIR){fs.mkdirSync(process.env.RECALL_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR,'chunk-replacement.json'),JSON.stringify(result,null,2));}
  console.log('CHUNK_REPLACEMENT_PASS',JSON.stringify(result));
 }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
