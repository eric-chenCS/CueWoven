// Search accuracy in the real extension: index the same-topic fixture through the real pipeline
// and search it through the background page. No network: MiniLM is read from a local folder.
// RECALL_MODEL_DIR must contain Xenova/all-MiniLM-L6-v2/{config.json,tokenizer.json,tokenizer_config.json,onnx/model_quantized.onnx} (or model.onnx for the older FP32 fixture).
// Optional: RECALL_SCREENSHOT_DIR for popup screenshots.
const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright');const fs=require('fs'),path=require('path'),os=require('os'),{pathToFileURL}=require('url');
const ext=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..'),models=process.env.RECALL_MODEL_DIR,shots=process.env.RECALL_SCREENSHOT_DIR||os.tmpdir();
if(!models)throw Error('Set RECALL_MODEL_DIR to a folder containing Xenova/all-MiniLM-L6-v2.');
(async()=>{
 const conf=await import(pathToFileURL(path.join(ext,'tests/fixtures/confusable.mjs')).href);
 const id=v=>v.padEnd(11,'_').slice(0,11);
 // Throwaway copy whose text worker reads MiniLM from a bundled folder (no network here).
 const dir=fs.mkdtempSync(path.join(process.env.RECALL_TEST_ROOT||os.tmpdir(),'recall-e2e-')),copy=path.join(dir,'ext');
 fs.cpSync(ext,copy,{recursive:true,filter:source=>!/node_modules|\.git/.test(path.relative(ext,source))});
 const model=path.join(copy,'test-models/Xenova/all-MiniLM-L6-v2');fs.cpSync(path.join(models,'Xenova/all-MiniLM-L6-v2'),model,{recursive:true});
 if(!fs.existsSync(path.join(model,'onnx/model_quantized.onnx')))fs.copyFileSync(path.join(model,'onnx/model.onnx'),path.join(model,'onnx/model_quantized.onnx'));
 const workerFile=path.join(copy,'offscreen/text-worker.js'),code=fs.readFileSync(workerFile,'utf8');
 if(!code.includes('env.allowLocalModels=false;'))throw Error('text-worker changed; update the e2e patch');
 fs.writeFileSync(workerFile,code.replace('env.allowLocalModels=false;',"env.allowLocalModels=true;env.allowRemoteModels=false;env.localModelPath=new URL('../test-models/',import.meta.url).href;").replace('env.useBrowserCache=true;','env.useBrowserCache=false;'));
 const context=await chromium.launchPersistentContext(path.join(dir,'profile'),{headless:true,executablePath:process.env.RECALL_BROWSER,viewport:{width:440,height:600},args:[`--disable-extensions-except=${copy}`,`--load-extension=${copy}`]});
 const errors=[],served=[];
 context.on('weberror',e=>errors.push(String(e.error())));
 await context.route('https://huggingface.co/**',route=>{
  const u=new URL(route.request().url()),m=u.pathname.match(/^\/(Xenova\/all-MiniLM-L6-v2)\/resolve\/main\/(.+)$/);
  if(!m)return route.fulfill({status:404,body:''});
  const file=path.join(models,m[1],m[2].replace('onnx/model_quantized.onnx','onnx/model.onnx'));
  served.push(m[2]);if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
  return route.fulfill({status:200,body:fs.readFileSync(file),contentType:file.endsWith('.json')?'application/json':'application/octet-stream'});
 });
 await context.route('https://i.ytimg.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#8a96a8"/></svg>'}));
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),base=`chrome-extension://${new URL(worker.url()).hostname}`;
  const options=await context.newPage();options.on('console',m=>m.type()==='error'&&errors.push('console: '+m.text()));
  await options.goto(`${base}/options/options.html`);
  const t0=Date.now();
  await options.evaluate(async({videos,ids})=>{
   await chrome.storage.local.set({onboardingComplete:true,settings:{enabled:false,maxAgeDays:0,perVideo:2}});
   const ready=await chrome.runtime.sendMessage({type:'warmup'});if(ready?.error)throw Error(ready.error);
   for(const [i,v] of videos.entries()){
    const r=await chrome.runtime.sendMessage({target:'offscreen',type:'index',method:'controlled-test',video:{videoId:ids[i],title:v.title,channel:v.channel,watchedAt:Date.now()-i*36e5},segments:v.chunks.map(c=>({start:c.start,dur:20,text:c.text}))});
    if(r.error)throw Error(v.videoId+': '+r.error);
   }
  },{videos:conf.videos,ids:conf.videos.map(v=>id(v.videoId))});
  console.log('indexed',conf.videos.length,'videos through the real pipeline in',Math.round((Date.now()-t0)/1000),'s');
  let right=0;const misses=[];
  for(const q of conf.queries){
   const res=await options.evaluate(m=>chrome.runtime.sendMessage(m),{type:'search',query:q.query,singleVideo:true,offset:0});
   if(res.error)throw Error(res.error);
   if(res.results[0]?.videoId===id(q.videoId))right++;else misses.push(`${q.query} → ${res.results[0]?.videoId}`);
   if(!res.results[0]||!('match' in res.results[0])||!Number.isFinite(res.results[0].score))throw Error('result lacks match/score: '+JSON.stringify(res.results[0]));
  }
  console.log(`real extension: right video first for ${right}/${conf.queries.length}`);misses.forEach(m=>console.log('  ✗ '+m));
  // Social titles use the same real model, owner grouping and date/source filters.
  await options.evaluate(async()=>{
   const now=Date.now(),items=[
    {kind:'video',url:'https://www.tiktok.com/@fixture/video/1001',title:'Quasar tire rotation ten percent',watchedAt:now},
    {kind:'video',url:'https://www.tiktok.com/@fixture/video/1002',title:'Quasar tire rotation ten percent',watchedAt:now-20*864e5},
    {kind:'video',url:'https://www.instagram.com/reel/fixture1001/',title:'Quasar tire rotation ten percent',watchedAt:now},
   ];
   const added=await chrome.runtime.sendMessage({target:'offscreen',type:'web-import',items});if(added.error)throw Error(added.error);
   for(const [site,host] of [['TikTok','tiktok.com'],['Instagram Reel','instagram.com']]){
    const found=await chrome.runtime.sendMessage({type:'search',query:'the '+site+' about quasar tire rotation last week',singleVideo:false});
    if(found.error||found.results.length!==1||!new URL(found.results[0].url).hostname.endsWith(host))throw Error('Social source/date retrieval failed: '+JSON.stringify(found));
   }
  });
  console.log('SOCIAL_SOURCE_DATE_PASS');
  // Popup screenshots: a close match, a related match, and a near tie.
  const popup=await context.newPage();await popup.goto(`${base}/popup/popup.html`);
  const shoot=async(query,name)=>{await popup.locator('#q').fill(query);await popup.waitForFunction(q=>!document.querySelector('#page-label')||document.querySelector('#page-label').textContent!=='Searching…',query);await popup.waitForTimeout(1500);await popup.screenshot({path:path.join(shots,name+'.png')});
   return popup.evaluate(()=>({tie:!document.querySelector('#tie-hint').hidden,tags:[...document.querySelectorAll('.match-sources span')].map(s=>s.textContent),title:document.querySelector('.result .title')?.textContent}));};
  for(const [query,name] of [['the Motor Explained video on battery degradation','popup-channel'],['battery','popup-generic'],['keeping things cool','popup-related']])console.log(name,JSON.stringify(await shoot(query,name)));
  console.log('page errors:',errors.length?errors:'none');
  require('assert/strict').ok(right>=119,`right video first for ${right}/${conf.queries.length}; v3.3.10 scored 114`);
  require('assert/strict').deepEqual(errors,[]);
  console.log('SEARCH_ACCURACY_PASS');
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exit(1);});
