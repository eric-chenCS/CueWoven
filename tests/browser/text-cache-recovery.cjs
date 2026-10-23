// Real production cache and worker; publisher model files can be served from local fixtures.
const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..'),prefix='https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/';
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(process.env.RECALL_TEST_ROOT||os.tmpdir(),'recall-cache-')),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 const report={errors:[]};context.on('weberror',event=>report.errors.push(event.error().message));
 try{
  if(process.env.RECALL_MODEL_DIR)await context.route(prefix+'**',route=>{
   const file=route.request().url().slice(prefix.length);assert.ok(['config.json','tokenizer.json','tokenizer_config.json','onnx/model_quantized.onnx'].includes(file));
   return route.fulfill({body:fs.readFileSync(path.join(process.env.RECALL_MODEL_DIR,'Xenova/all-MiniLM-L6-v2',file)),contentType:file.endsWith('.json')?'application/json':'application/octet-stream'});
  });
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),page=await context.newPage();await page.goto('chrome-extension://'+new URL(worker.url()).hostname+'/options/options.html');
  report.recovery=await page.evaluate(async prefix=>{
   const cache=await caches.open('transformers-cache'),url=prefix+'onnx/model_quantized.onnx',other='https://huggingface.co/other-model/resolve/main/onnx/model.onnx';
   await cache.put(url,new Response(new Uint8Array([8,1,18,4,84,101,115,116])));await cache.put(other,new Response('unrelated model cache sentinel'));
   const {createTextModel}=await import(chrome.runtime.getURL('offscreen/text-model.js')),model=createTextModel();
   try{
    const error=await model.warmup().then(()=>null,e=>e.message);
    if(!/No graph was found in the protobuf/.test(error))throw Error('Expected malformed cached ONNX error: '+error);
    if(await cache.match(url))throw Error('Invalid ONNX file remained cached after failure');
    if(await(await cache.match(other)).text()!=='unrelated model cache sentinel')throw Error('Recovery deleted another model');
    const vectors=await model.embed(['The speaker says getting older is not fun and his back hurts.','Warm water makes coral lose its algae.']);
    return{error,dimensions:vectors.map(v=>v.length),vectors:vectors.map(v=>Array.from(v)),invalidEntryRemoved:true,otherModelPreserved:true};
   }finally{model.release();}
  },prefix);
  assert.deepEqual(report.recovery.dimensions,[384,384]);
  await context.unrouteAll({behavior:'wait'});await context.setOffline(true);
  const offline=await page.evaluate(async()=>{
   const {createTextModel}=await import(chrome.runtime.getURL('offscreen/text-model.js')),model=createTextModel();
   try{return(await model.embed(['The speaker says getting older is not fun and his back hurts.','Warm water makes coral lose its algae.'])).map(v=>Array.from(v));}finally{model.release();}
  });
  assert.deepEqual(offline,report.recovery.vectors,'fresh offline worker reuses repaired valid cache without changing vectors');delete report.recovery.vectors;
  assert.deepEqual(report.errors,[]);report.offlineReloadIdentical=true;report.pass=true;console.log('TEXT_CACHE_RECOVERY_PASS',JSON.stringify(report));
 }finally{if(process.env.RECALL_REPORT_DIR)fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR,'text-cache-recovery.json'),JSON.stringify(report,null,2));await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
