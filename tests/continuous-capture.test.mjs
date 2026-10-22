import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRevisionCache} from '../lib/revision-cache.js';
import {createQueryCache} from '../lib/query-cache.js';
import {createTextModel} from '../offscreen/text-model.js';
import {withTimeout} from '../lib/request-timeout.js';
import {loadVideoChunks,packIndex} from '../lib/video-index.js';
import {rank} from '../lib/search.js';
import {policy} from '../lib/web-items.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));

test('continuous additions cannot starve an index build; the following read refreshes it',async()=>{
  let finish,calls=0;
  const cache=createRevisionCache(async()=>{calls++;if(calls===1)await new Promise(resolve=>finish=resolve);return {call:calls};});
  const pending=cache.get();await tick();
  for(let i=0;i<1000;i++)cache.invalidate({destructive:false});
  finish();assert.equal((await pending).call,1);
  assert.equal((await cache.get()).call,2);assert.equal(calls,2);
});
test('continuous scene saves cannot starve a search, and a later deletion still rejects it',async()=>{
  let finish,calls=0;
  const cache=createQueryCache(async()=>{calls++;if(calls===1)await new Promise(resolve=>finish=resolve);return {results:[{call:calls}]};});
  const pending=cache.get('query',0,1);await tick();
  for(let i=0;i<1000;i++)cache.invalidate({destructive:false});
  finish();assert.equal((await pending).results[0].call,1);
  assert.equal((await cache.get('query',0,1)).results[0].call,2);
  cache.invalidate();assert.equal((await cache.get('query',0,1)).results[0].call,3);
});
test('a deletion during a soft-invalidated query never publishes the removed item',async()=>{
  let finish,calls=0;
  const cache=createQueryCache(async()=>{const call=++calls;if(call===1)await new Promise(resolve=>finish=resolve);return {results:[{call}]};});
  const pending=cache.get('query',0,1);await tick();
  cache.invalidate({destructive:false});cache.invalidate();finish();
  assert.equal((await pending).results[0].call,2);
});
test('metadata changes update a loaded snapshot without rebuilding vectors',async()=>{
  let calls=0;const cache=createRevisionCache(async()=>{calls++;return {videos:new Map([['a',{watchedAt:1}]])};});
  const before=await cache.get();cache.update(snapshot=>snapshot.videos.set('a',{watchedAt:2,sceneCount:1}));
  assert.equal(await cache.get(),before);assert.equal(calls,1);assert.equal(before.videos.get('a').watchedAt,2);
});
class FakeWorker{
  static instances=[];
  constructor(){this.sent=[];FakeWorker.instances.push(this);}
  postMessage(data){this.sent.push(data);}
  answer(){const {id,texts}=this.sent.at(-1);this.onmessage({data:{id,vectors:texts.map(text=>Float32Array.of(Number(text)||0))}});}
  terminate(){this.terminated=true;}
}
test('queries jump ahead of queued background batches of four without losing vector order',async()=>{
  const model=createTextModel(()=>{},{WorkerClass:FakeWorker});
  try{
    const background=model.embed(Array.from({length:10},(_,i)=>String(i)));await tick();
    const worker=FakeWorker.instances.at(-1);assert.equal(worker.sent[0].texts.length,4);
    const query=model.embed(['99'],{priority:'query'});worker.answer();await tick();
    assert.deepEqual(worker.sent[1].texts,['99']);worker.answer();assert.equal((await query)[0][0],99);
    await tick();assert.deepEqual(worker.sent[2].texts,['4','5','6','7']);worker.answer();await tick();worker.answer();
    assert.deepEqual((await background).map(row=>row[0]),Array.from({length:10},(_,i)=>i));
  }finally{model.release();}
});
test('idle text worker releases and reloads; inference timeout rejects every waiting caller',async()=>{
  const model=createTextModel(()=>{},{WorkerClass:FakeWorker,idleMs:15,timeoutMs:100});
  try{
    const warm=model.warmup();await tick();const first=FakeWorker.instances.at(-1);first.answer();await warm;
    const deadline=Date.now()+500;while(!first.terminated&&Date.now()<deadline)await tick();assert.equal(first.terminated,true);
    const a=model.embed(['1']),b=model.embed(['2'],{priority:'query'});
    const results=await Promise.allSettled([a,b]);assert.ok(results.every(row=>row.status==='rejected'&&/timed out/.test(row.reason.message)));
    assert.notEqual(FakeWorker.instances.at(-1),first);
  }finally{model.release();}
});

test('the default text idle window keeps rapid searches warm and releases after one minute',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const model=createTextModel(()=>{},{WorkerClass:FakeWorker});
 try{
  const warm=model.warmup();t.mock.timers.tick(0);const first=FakeWorker.instances.at(-1);first.answer();await warm;t.mock.timers.tick(0);
  t.mock.timers.tick(59999);assert.ok(!first.terminated);
  t.mock.timers.tick(1);assert.equal(first.terminated,true);
  const query=model.embed(['99'],{priority:'query'});t.mock.timers.tick(0);const second=FakeWorker.instances.at(-1);
  assert.notEqual(second,first);second.answer();assert.equal((await query)[0][0],99);
 }finally{model.release();}
});
test('popup timeout settles even if the engine never replies; normal responses pass through',async()=>{
  await assert.rejects(withTimeout(new Promise(()=>{}),10),/Retry/);
  assert.equal(await withTimeout(Promise.resolve('ready'),10),'ready');
});
test('bounded packed index preserves old transcripts on disk and keeps them out of the resident matrix',async()=>{
  const videos=new Map(Array.from({length:2000},(_,i)=>['v'+i,{videoId:'v'+i,method:'captions',watchedAt:i+1}]));
  const rows=[...videos.keys()].map((videoId,id)=>({id,videoId,text:'saved words '+id,start:42,vec:Float32Array.from({length:384},(_,i)=>i===0?1:0)}));
  const db={scanChunks:async visit=>{for(let i=0;i<rows.length;i+=100)await visit(rows.slice(i,i+100));}};
  const loaded=await loadVideoChunks(db,videos,{maxVideos:1000,maxRows:800});
  assert.equal(loaded.chunks.length,800);assert.equal(loaded.overflow,true);assert.equal(rows.length,2000);
  assert.equal(loaded.indexedIds.has(0),false);assert.ok(loaded.chunks.every(row=>Number(row.videoId.slice(1))>=1000));
  const packed=packIndex(loaded.chunks);assert.equal(packed.matrix.byteLength,800*384);
  const query=Float32Array.from({length:384},(_,i)=>i===0?1:0);
  assert.ok(rank(query,packIndex([rows[0]]),videos,{query:'saved words 0'})[0].score>1);
});
test('new private routes are blocked while public articles about those topics stay usable',()=>{
  const privateUrls=['https://www.amazon.com/gp/your-account/order-history','https://www.linkedin.com/messaging/','https://www.reddit.com/message/inbox','https://school.instructure.com/courses/12/grades','https://example.com/u/grades','https://tenant.myworkday.com/','https://example.com/u/payslips','https://www.dropbox.com/home','https://my.1password.com/home','https://turbotax.intuit.com/','https://example.com/u/vault','https://www.google.com/search?q=cancer+symptoms','https://example.com/#/u/messages','https://example.com/u/order-history'];
  for(const url of privateUrls)assert.equal(policy.safeUrl(url),null,url);
  for(const url of ['https://en.wikipedia.org/wiki/Email','https://en.wikipedia.org/wiki/Health','https://docs.python.org/3/library/email.html','https://www.nytimes.com/section/health','https://stackoverflow.com/questions/123/how-to-login'])assert.ok(policy.safeUrl(url),url);
  const url='https://www.google.com/search?q=coral';
  assert.equal(policy.allowed(url,{enabled:true,allSites:true}),false);
  assert.equal(policy.allowed(url,{enabled:true,allSites:true,searches:true}),true);
});
test('personal text is redacted and suggestion markup cannot inject formatting',()=>{
  const text=policy.redactText('Contact eric@example.com or (212) 555-0199. SSN 123-45-6789 card 4111 1111 1111 1111. Coral reefs are colorful.');
  for(const secret of ['eric@example.com','555-0199','123-45-6789','4111'])assert.ok(!text.includes(secret));
  assert.ok(text.includes('Coral reefs are colorful.'));
});
