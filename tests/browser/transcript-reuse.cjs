const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
process.env.RECALL_EXTENSION ||= path.resolve(__dirname,'../..');
let profile;
(async()=>{const f=await require(process.env.RECALL_EXTENSION+'/tests/browser/web-fixture.cjs')({prepareExtension(extension){profile=path.dirname(extension);const p=path.join(extension,'offscreen/offscreen.js');let s=fs.readFileSync(p,'utf8');s=s.replace('const embed = textModel.embed;','let embedCount=0;const embed=(texts,opts)=>{embedCount+=texts.length;return textModel.embed(texts,opts);};');s=s.replace('ping: async () => ({ ok: true }),','ping:async({reset})=>{const r={ok:true,embedCount};if(reset)embedCount=0;return r;},');fs.writeFileSync(p,s);}});
const send=async msg=>{const r=await f.send(msg);assert.equal(r?.error,undefined,JSON.stringify(r));return r;};
try{await f.enable();const video={videoId:'reusetest01',title:'Original video title',channel:'Fixture',watchedAt:Date.now()};const line='The presenter describes getting older while wearing a back brace because his lower back hurts after sitting at his desk for long periods. He explains that regular movement can help him feel more comfortable during the work day. These remarks are recorded as a deliberate timestamped test passage.';
const segments=[{start:0,dur:8,text:line},{start:45,dur:9,text:line}];const index=(video,segments)=>send({target:'offscreen',type:'index',video,segments,method:'captions'});
const rows=()=>f.options.evaluate(async id=>{const db=await import(chrome.runtime.getURL('lib/db.js'));return (await db.chunksOf(id)).map(({id,...r})=>({...r,vec:Array.from(r.vec)}));},video.videoId);
await index(video,segments);const initial=await rows();assert.equal(initial.length,2);assert.deepEqual(initial[0].vec,initial[1].vec);
await f.worker.evaluate(()=>chrome.offscreen.closeDocument());await send({type:'status'});const engine=await send({target:'offscreen',type:'ping',reset:true});assert.equal(engine.embedCount,0);
await index({...video,title:'Updated video title'},segments.map(r=>({...r,start:r.start+10})));assert.equal((await send({target:'offscreen',type:'ping'})).embedCount,0);const moved=await rows();assert.deepEqual(moved.map(r=>r.start),[10,55]);assert.deepEqual(moved.map(r=>r.vec),initial.map(r=>r.vec));
const found=await send({type:'search',query:'the speaker getting older with back pain and a back brace',inferFilters:false});assert.equal(found.results[0]?.videoId,video.videoId);assert.equal(found.results[0]?.start,10);
await send({target:'offscreen',type:'ping',reset:true});await index(video,[segments[0],{...segments[1],text:line+' This is a changed observation.'}]);assert.equal((await send({target:'offscreen',type:'ping'})).embedCount,2);const changed=await rows();assert.equal(changed[0].text,initial[0].text);assert.notDeepEqual(changed[1].vec,initial[1].vec);
await f.options.evaluate(async()=>{const db=await import(chrome.runtime.getURL('lib/db.js'));const video=await db.getVideo('reusetest01');if(video.title!=='Original video title')throw Error('Updated metadata missing');});
await f.options.evaluate(async()=>{const r=indexedDB.open('recall');const db=await new Promise((yes,no)=>{r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error)});const tx=db.transaction('chunks','readwrite'),req=tx.objectStore('chunks').index('videoId').openCursor('reusetest01');req.onsuccess=()=>{const c=req.result;if(c){c.update({...c.value,embeddingVersion:'legacy'});c.continue();}};await new Promise((yes,no)=>{tx.oncomplete=yes;tx.onabort=()=>no(tx.error)});db.close();});
await send({target:'offscreen',type:'ping',reset:true});await index(video,segments);assert.equal((await send({target:'offscreen',type:'ping'})).embedCount,2);assert.deepEqual(await rows(),initial);
// Queue a replacement immediately behind the snapshot read; the read must remain coherent.
await f.options.evaluate(async()=>{
 const db=await import(chrome.runtime.getURL('lib/db.js')),id='snapshot001',vec=new Int8Array(384).fill(1);
 const a={videoId:id,title:'Recipe A',method:'history-title'},b={videoId:id,title:'Recipe B',method:'captions'};
 const row=text=>({videoId:id,text,start:0,vec,scale:.01,embeddingVersion:'minilm-l6-v2-body-v2'});
 await db.replaceVideo(a,[row('Words A')]);const original=IDBDatabase.prototype.transaction;let replacement;
 IDBDatabase.prototype.transaction=function(stores,mode,...args){
  const tx=original.call(this,stores,mode,...args),names=Array.isArray(stores)?stores:[stores];
  if(mode!=='readwrite'&&names.includes('videos')){
   IDBDatabase.prototype.transaction=original;
   const write=original.call(this,['videos','chunks'],'readwrite');replacement=new Promise((yes,no)=>{write.oncomplete=yes;write.onabort=()=>no(write.error)});
   write.objectStore('videos').put(b);const cs=write.objectStore('chunks'),req=cs.index('videoId').getAllKeys(id);
   req.onsuccess=()=>{for(const key of req.result)cs.delete(key);cs.add(row('Words B'));};
  }return tx;
 };
 let snapshot;try{snapshot=await db.videoWithChunks(id);}finally{IDBDatabase.prototype.transaction=original;}
 if(snapshot.video.title!=='Recipe A'||snapshot.chunks[0].text!=='Words A')throw Error('Snapshot mixed metadata and vectors');
 await replacement;const next=await db.videoWithChunks(id);if(next.video.title!=='Recipe B'||next.chunks[0].text!=='Words B')throw Error('Concurrent replacement did not complete');await db.deleteVideo(id);
});
await f.options.evaluate(()=>chrome.storage.local.set({settings:{enabled:false}}));const rejected=await f.send({target:'offscreen',type:'index',video,segments});assert.match(rejected.error,/paused|excluded/);assert.deepEqual(await rows(),initial);
const result={pass:true,profile,checks:['real MiniLM inference','vague search and moved timestamp','duplicates retain separate timestamps','reuse survives engine restart','changed input retains original full batch','updated metadata','legacy vectors recomputed','capture pause enforced','atomic metadata/vector snapshot']};if(process.env.RECALL_REPORT_DIR)fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR,'browser-regression.json'),JSON.stringify(result,null,2));console.log('INCREMENTAL_REGRESSION_PASS');
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
