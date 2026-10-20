// Real Edge/WASM inference; model downloads can be fulfilled from verified local publisher files.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),{pathToFileURL}=require('url'),fixture=require('./web-fixture.cjs');
const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..'),output=process.env.RECALL_REPORT_DIR||require('os').tmpdir();
(async()=>{
 const assets=await import(pathToFileURL(path.join(root,'offscreen/rerank-assets.js')).href),f=await fixture(),errors=[],requests=[],rows=[];
 f.context.on('weberror',e=>errors.push(e.error().message));
 let offline=false,corrupt=false;
 const prefix=`https://huggingface.co/${assets.RERANK_MODEL}/resolve/${assets.RERANK_REVISION}/`;
 try{
  await f.context.route(prefix+'**',async route=>{
   const request=route.request(),file=request.url().slice(prefix.length);requests.push({file,method:request.method()});
   assert.equal(request.method(),'GET');assert.equal(new URL(request.url()).search,'');assert.equal(request.headers().cookie,undefined);
   if(offline)return route.abort('internetdisconnected');
   if(corrupt&&file==='config.json')return route.fulfill({body:Buffer.alloc(assets.RERANK_ASSETS[file].bytes,32)});
   if(!process.env.RECALL_ETTIN_MODELS)return route.continue();
   assert.ok(Object.hasOwn(assets.RERANK_ASSETS,file));
   const local=path.join(process.env.RECALL_ETTIN_MODELS,file),bytes=fs.readFileSync(local);
   assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),assets.RERANK_ASSETS[file].sha256);
   return route.fulfill({body:bytes,contentType:'application/octet-stream'});
  });
  const initialized=await f.options.evaluate(async({base,cacheName,prefix,bytes})=>{
   // Same-length poison ensures the recovery check verifies SHA256, not just length.
   const cache=await caches.open(cacheName);await cache.put(prefix+'config.json',new Response(new Uint8Array(bytes)));
   const {createReranker}=await import(base+'/offscreen/rerank-model.js');window.createReranker=createReranker;window.reranker=createReranker();
   const t=performance.now();const ready=await reranker.warmup();return{ready,loadMs:performance.now()-t};
  },{base:f.base,cacheName:'cuewoven-ettin-'+assets.RERANK_REVISION,prefix,bytes:assets.RERANK_ASSETS['config.json'].bytes});
  assert.equal(initialized.ready,true);assert.equal(requests.filter(r=>r.file==='config.json').length,1);
  await f.options.evaluate(()=>reranker.release());
  const beforeOffline=requests.length;offline=true;
  const cached=await f.options.evaluate(async()=>{window.reranker=createReranker();return await reranker.warmup();});
  assert.equal(cached,true);assert.equal(requests.length,beforeOffline,'cached startup makes no network requests');
  await f.options.evaluate(()=>reranker.release());offline=false;
  await f.options.evaluate(async base=>{
   window.realWorker=new Worker(base+'/offscreen/rerank-worker.js',{type:'module'});let next=0;const pending=new Map();
   realWorker.onmessage=({data})=>{const item=pending.get(data.id);if(item){clearTimeout(item.timer);pending.delete(data.id);item.resolve(data);}};
   window.callRerank=(type,body={})=>new Promise((resolve,reject)=>{const id=type==='init'?0:++next;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Worker integration timed out'));},30000);pending.set(id,{resolve,timer});realWorker.postMessage({id,type,...body});});
   const ready=await callRerank('init');if(!ready.ready)throw Error('Real worker failed to load.');
  },f.base);
  const controls={query:'Which planet is known as the Red Planet?',documents:["Venus is often called Earth's twin because of its similar size and proximity.",'Mars, known for its reddish appearance, is often referred to as the Red Planet.','Jupiter, the largest planet in our solar system, has a prominent red spot.','Saturn, famous for its rings, is sometimes mistaken for the Red Planet.']};
  const expected=[6.36248779296875,10.606649398803711,8.425724029541016,9.431831359863281];
  const control=await f.options.evaluate(body=>callRerank('score',body),controls);assert.ok(control.scores);assert.equal(control.scores.indexOf(Math.max(...control.scores)),1);
  assert.ok(Math.max(...control.scores.map((s,i)=>Math.abs(s-expected[i])))<.001);
  if(process.env.RECALL_RANK_CASES&&process.env.RECALL_RANK_SCORES){
   const inputs=JSON.parse(fs.readFileSync(process.env.RECALL_RANK_CASES,'utf8')).rows.filter(r=>r.split!=='train');
   const prior=JSON.parse(fs.readFileSync(process.env.RECALL_RANK_SCORES,'utf8')).reports.find(r=>r.label==='Ettin32').cases;
   const inputMap=new Map(inputs.map(r=>[JSON.stringify([r.split,r.query]),r]));
   const chosen=Array.from({length:40},(_,i)=>prior[Math.floor(i*(prior.length-1)/39)]);
   for(const original of chosen){
    const input=inputMap.get(JSON.stringify([original.split,original.query]));assert.ok(input);
    if(input.candidates.length<2)continue;
    const t=performance.now(),result=await f.options.evaluate(body=>callRerank('score',body),{query:input.query,documents:input.candidates.slice(0,10).map(c=>c.doc)});
    const delta=Math.max(...result.scores.map((s,i)=>Math.abs(s-original.scores[i])));assert.ok(delta<.001,'published-head/browser parity: '+delta);
    rows.push({split:input.split,query:input.query,delta,ms:performance.now()-t,scores:result.scores});
    await new Promise(resolve=>setTimeout(resolve,400));
   }
  }
  const malformed=[{query:'',documents:['a','b']},{query:'x'.repeat(2001),documents:['a','b']},{query:'memory',documents:[]},{query:'memory',documents:Array(11).fill('text')},{query:'memory',documents:['x'.repeat(8193),'b']},{query:'memory',documents:[null,'b']}];
  for(const body of malformed)assert.ok((await f.options.evaluate(body=>callRerank('score',body),body)).error);
  await f.options.evaluate(()=>realWorker.terminate());
  const budget=await f.options.evaluate(async()=>{
   const workers=[];const rr=createReranker({timeoutMs:5,WorkerClass:class extends Worker{constructor(...args){super(...args);workers.push(this);}terminate(){this.stopped=true;super.terminate();}}});
   if(!await rr.warmup())throw Error('Deadline test could not load.');
   const hits=Array.from({length:10},(_,i)=>({videoId:'candidate'+i,title:'A speaker',text:'The person talked about aging and back pain.',score:.3-i*.001,match:'related'}));
   const t=performance.now(),result=await rr.rerank('the older speaker having back pain',hits),ms=performance.now()-t;
   const state=rr.status(),stopped=workers[0].stopped;rr.release();return{unchanged:result.hits===hits,ms,state,stopped};
  });
  assert.equal(budget.unchanged,true);assert.equal(budget.stopped,true);assert.equal(budget.state.status,'cooldown');assert.ok(budget.ms<500);
  await f.options.evaluate(async cacheName=>{await(await caches.open(cacheName)).delete('https://huggingface.co/cross-encoder/ettin-reranker-32m-v1/resolve/b33e5ceb5110773ea9cf5e00c9bedc83a8c2afdd/config.json');},'cuewoven-ettin-'+assets.RERANK_REVISION);
  corrupt=true;
  const rejected=await f.options.evaluate(async()=>{const rr=createReranker();const ready=await rr.warmup(),state=rr.status();rr.release();return{ready,state};});
  assert.equal(rejected.ready,false);assert.equal(rejected.state.status,'cooldown');corrupt=false;
  const healthy=await f.options.evaluate(async()=>{const rr=createReranker();const result=await rr.warmup();rr.release();return result;});assert.equal(healthy,true);
  assert.deepEqual(errors,[]);
  const report={browser:await f.context.browser().version(),model:assets.RERANK_MODEL,revision:assets.RERANK_REVISION,initialLoad:initialized,control,expectedControl:expected,parityRows:rows,deadline:budget,checks:{poisonedCacheRecovered:true,cachedStartupOffline:true,pinnedGetRequestsOnly:true,malformedRequestsRejected:malformed.length,corruptDownloadRejected:true,subsequentReloadRecovered:true},requests,errors};
  fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'cuewoven-ettin-worker-tests.json'),JSON.stringify(report,null,2));
  console.log('ETTIN_WORKER_PASS',JSON.stringify({...report,parityRows:rows.length,requests:requests.length}));
 }finally{await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
