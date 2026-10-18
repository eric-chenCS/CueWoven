const fixture=require('./web-fixture.cjs'),assert=require('assert/strict');
(async()=>{
 const f=await fixture();
 try{
  await f.options.evaluate(()=>chrome.storage.local.set({settings:{enabled:false,maxAgeDays:0}}));
  await f.send({type:'warmup'});
  const saved=await f.send({target:'offscreen',type:'index',method:'captions',video:{videoId:'old00000000',title:'Old helium detector source',watchedAt:1e12},segments:[{start:64,text:'A unique helium detector inside the cabin finds a leaking valve.'}]});assert.ok(saved.chunkCount);
  await f.options.evaluate(async()=>{
   const database=await new Promise((resolve,reject)=>{const r=indexedDB.open('recall',6);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   const tx=database.transaction(['videos','chunks'],'readwrite'),vec=new Int8Array(384);
   for(let i=0;i<1000;i++){
    const videoId=String(i).padStart(11,'x');
    tx.objectStore('videos').put({videoId,title:'Newer generic source '+i,method:'captions',watchedAt:Date.now(),indexedAt:Date.now(),chunkCount:1});
    tx.objectStore('chunks').put({videoId,start:1,text:'Unrelated ordinary newer video.',lexicalText:'unrelated ordinary newer video',vec,scale:1,embeddingVersion:'minilm-l6-v2-body-v2'});
   }
   await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});database.close();
  });
  await f.send({type:'warmup'});
  const result=await f.send({type:'search',query:'"unique helium detector inside the cabin"',singleVideo:true});
  assert.equal(result.results[0].videoId,'old00000000');assert.equal(result.results[0].start,64);
  assert.equal((await f.send({type:'list'})).videos.length,1001);
  const backup=await f.send({type:'export'});assert.equal(backup.videos.find(row=>row.videoId==='old00000000').chunks[0].text,'A unique helium detector inside the cabin finds a leaking valve.');
  await f.send({type:'delete',videoId:'old00000000'});
  assert.ok((await f.send({type:'search',query:'"unique helium detector inside the cabin"',singleVideo:true})).results.every(hit=>hit.videoId!=='old00000000'));
  console.log('VIDEO_OVERFLOW_PASS: old transcript outside newest 1,000 remains searchable at 64s, export preserves its words, deletion removes it. 1,000 synthetic zero-vector distractors; real old-vector/query inference.');
 }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
