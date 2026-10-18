// Isolated IndexedDB capacity/eviction and vector-only search at the full visual count.
const fixture=require('./web-fixture.cjs'),assert=require('assert/strict');
(async()=>{
 const f=await fixture();
 try{
  const report=await f.options.evaluate(async()=>{
   const db=await import('../lib/db.js'),{SCENES_TOTAL,SCENE_BYTES_TOTAL,rankScenes}=await import('../lib/scenes.js');
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
   canvas.getContext('2d').fillRect(0,0,320,180);const image=canvas.toDataURL('image/jpeg',.6);
   await db.clearAll();
   const database=await new Promise((resolve,reject)=>{const r=indexedDB.open('recall');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
   const tx=database.transaction(['videos','scenes'],'readwrite'),videos=tx.objectStore('videos'),scenes=tx.objectStore('scenes');
   for(let i=0;i<84;i++)videos.put({videoId:'video'+i,title:'Capacity fixture',sceneCount:0});
   for(let i=0;i<=SCENES_TOTAL;i++){const vec=new Float32Array(512);vec[0]=1;const videoId='video'+(i%84);scenes.put({key:videoId+':'+i,videoId,start:i,indexedAt:i,image,vec});}
   await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});database.close();
   const start=performance.now();await db.scenes.put({key:'video0:new',videoId:'video0',start:0,indexedAt:SCENES_TOTAL+2,image,vec:new Float32Array(512)});
   const writeMs=performance.now()-start,times=[],q=new Float32Array(512);q[0]=1;
   let rows;
   const parents=new Map((await db.listVideos()).map(v=>[v.videoId,v]));
   for(let i=0;i<3;i++){const t=performance.now();rows=await db.scenes.vectors();rankScenes(q,rows,parents);times.push(performance.now()-t);}
   const count=rows.length,oldestRemoved=!rows.some(r=>r.key==='video0:0'||r.key==='video1:1'),metadataOnly=rows.every(r=>r.image===undefined);
   // Construct a large Blob from shared chunks, avoiding a 240 MB JavaScript allocation.
   await db.clearAll();await db.items.put({videoId:'web_'+'a'.repeat(64),kind:'page',url:'https://example.com/large',title:'Byte budget fixture'},[]);
   const videoId='web_'+'a'.repeat(64),chunk=new Blob([new Uint8Array(1024*1024)]),large=new Blob(Array(239).fill(chunk));
   await db.scenes.put({key:videoId+':first',videoId,start:0,indexedAt:1,image:large,vec:new Float32Array(512),articleImage:true});
   const retainedBelowCap=(await db.scenes.vectors()).length===1;
   await db.scenes.put({key:videoId+':second',videoId,start:0,indexedAt:2,image:new Blob(Array(2).fill(chunk)),vec:new Float32Array(512),articleImage:true});
   const after=await db.scenes.vectors(),oldestByteEvicted=after.length===1&&after[0].key===videoId+':second';
   return {count,cap:SCENES_TOTAL,bytesCap:SCENE_BYTES_TOTAL,oldestRemoved,metadataOnly,retainedBelowCap,oldestByteEvicted,writeMs,vectorReadAndRankMs:times};
  });
  assert.equal(report.count,20000);assert.equal(report.cap,20000);assert.equal(report.bytesCap,240*1024*1024);
  for(const key of ['oldestRemoved','metadataOnly','retainedBelowCap','oldestByteEvicted'])assert.equal(report[key],true,key);
  assert.ok(Math.max(...report.vectorReadAndRankMs)<1200,'Visual lookup exceeds the optional visual-search budget');
  console.log('VISUAL_CAPACITY_PASS',JSON.stringify(report));
 }finally{await f.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
