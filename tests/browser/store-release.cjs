// Tests the extracted store package without changing its manifest, workers or models.
const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const extension=path.resolve(process.env.RECALL_EXTENSION||path.join(__dirname,'../..'));
const output=path.resolve(process.env.RECALL_SCREENSHOT_DIR||os.tmpdir());
const report={version:JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'))).version,checks:[],network:[],live:[]};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const bounded=(promise,ms,label)=>Promise.race([promise,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error(label+' timed out')),ms);timer.unref();})]);
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(process.env.RECALL_TEST_ROOT||os.tmpdir(),'cuewoven-store-')),{headless:true,executablePath:process.env.RECALL_BROWSER,viewport:{width:1100,height:850},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--autoplay-policy=no-user-gesture-required']});
 let options;
 try{
  context.on('requestfinished',request=>{const url=new URL(request.url());if(/huggingface|hf\.co|xethub/.test(url.hostname))report.network.push({host:url.hostname,file:url.pathname.split('/').at(-1),status:'finished'});});
  context.on('requestfailed',request=>{const url=new URL(request.url());if(/huggingface|hf\.co|xethub/.test(url.hostname)){const failure={host:url.hostname,file:url.pathname.split('/').at(-1),error:request.failure()?.errorText};report.network.push(failure);console.log('MODEL_NETWORK_FAILURE',JSON.stringify(failure));}});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const base='chrome-extension://'+new URL(worker.url()).hostname;
  options=await context.newPage();await options.goto(base+'/options/options.html');
  const send=msg=>options.evaluate(msg=>chrome.runtime.sendMessage(msg),msg);
  const settings=enabled=>options.evaluate(enabled=>chrome.storage.local.set({settings:{enabled,dwellSeconds:0,maxAgeDays:0,speechEnabled:false,scenesEnabled:false,screenTextEnabled:false,articleImagesEnabled:false}}),enabled);
  assert.ok(!(await send({type:'status'})).error,'offscreen engine is ready before sending direct engine requests');
  assert.deepEqual(await options.evaluate(()=>caches.keys()),[],'fresh profile starts without model cache');
  await settings(true);
  await options.evaluate(()=>{window.modelLoading=false;chrome.runtime.onMessage.addListener(msg=>{if(msg.type==='model-status'&&msg.state.status==='loading')window.modelLoading=true;});});
  console.log('STORE_CHECK: start a real cold model download, then pause its pending save');
  const pending=send({target:'offscreen',type:'index',video:{videoId:'pauseCold01',title:'Pending cold download',watchedAt:Date.now()},segments:[{start:0,text:'This caption must not survive pausing during model download.'}]});
  await Promise.race([options.waitForFunction(()=>window.modelLoading),pending.then(result=>{throw Error('Indexing ended before loading was observed: '+JSON.stringify(result));})]);await settings(false);
  const cancelled=await bounded(pending,180000,'cold model inference');assert.match(cancelled.error,/paused|excluded/);
  assert.equal((await send({type:'list'})).videos.length,0);
  const cached=await options.evaluate(async()=>{const result=[];for(const name of await caches.keys())for(const request of await (await caches.open(name)).keys())result.push(new URL(request.url).pathname);return result;});
  assert.ok(cached.some(file=>file.endsWith('/onnx/model_quantized.onnx')),'cold inference downloaded and cached real model weights');
  report.modelCache=cached;
  report.checks.push('cold remote model download and inference complete; pause before commit prevents storage');
  console.log('STORE_CHECK: sample search, offline search and backup roundtrip');
  const popup=await context.newPage();await popup.goto(base+'/popup/popup.html');
  const loaded=await popup.evaluate(()=>chrome.runtime.sendMessage({type:'load-samples'}));assert.ok(!loaded.error,loaded.error);
  let found=await send({type:'search',query:'why do batteries wear out'});assert.equal(found.results[0].videoId,'rcDemo00001');
  await context.setOffline(true);found=await send({type:'search',query:'heat reduces lithium battery capacity'});assert.equal(found.results[0].videoId,'rcDemo00001');await context.setOffline(false);
  const backup=await send({type:'export'});assert.equal(backup.videos.length,5);
  assert.ok(!(await send({type:'clear'})).error);assert.equal((await send({type:'list'})).videos.length,0);
  const restored=await send({type:'import',data:backup});assert.ok(!restored.error,restored.error);assert.equal((await send({type:'list'})).videos.length,5);
  report.checks.push('sample search; unseen query offline; backup restore while automatic saving is paused');
  await send({type:'clear'});await settings(true);
  const captionRequest=deferred(),releaseCaption=deferred();
  await context.route('https://www.youtube.com/watch?v=pauseRace01',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><title>Pause regression</title><script>window.ytInitialPlayerResponse={videoDetails:{videoId:'pauseRace01',title:'Pending transcript regression',author:'Fixture',lengthSeconds:'240'},captions:{playerCaptionsTracklistRenderer:{captionTracks:[{baseUrl:'https://www.youtube.com/api/timedtext?v=pauseRace01',languageCode:'en'}]}}};</script><h1>Controlled pending transcript</h1>`}));
  await context.route('https://www.youtube.com/api/timedtext?v=pauseRace01*',async route=>{captionRequest.resolve();await releaseCaption.promise;await route.fulfill({contentType:'application/json',body:JSON.stringify({events:[0,1,2].map(i=>({tStartMs:i*1000,dDurationMs:1000,segs:[{utf8:'Forbidden late caption '+i}]}))})});});
  const fixture=await context.newPage();await fixture.goto('https://www.youtube.com/watch?v=pauseRace01');
  console.log('STORE_CHECK: delay a real content-script caption request, pause, then release it');
  await bounded(captionRequest.promise,30000,'content script transcript request');await settings(false);await fixture.waitForTimeout(200);releaseCaption.resolve();
  await fixture.waitForTimeout(1500);
  const saved=await send({type:'export'});assert.ok(saved.videos.every(video=>video.chunks.every(chunk=>!chunk.text.includes('Forbidden late caption'))));
  await fixture.close();await context.unrouteAll({behavior:'wait'});
  await settings(true);
  const invalid=await send({type:'index-video',video:{videoId:'aaaaaaaaaaa'},segments:[{start:0,text:'Unrelated page'}]});assert.match(invalid.error,/Invalid video capture source/);
  report.checks.push('delayed caption response cannot save after pause; unrelated extension page rejected by capture router');
  if(process.env.RECALL_SKIP_LIVE==='true'){console.log('STORE_RELEASE_PASS',JSON.stringify(report));return;}
  await send({type:'clear'});
  console.log('STORE_CHECK: unmocked public YouTube playback');
  for(const id of ['jNQXAC9IVRw','aqz-KE-bpKQ']){
   const page=await context.newPage(),entry={videoId:id};report.live.push(entry);
   try{
    const response=await page.goto('https://www.youtube.com/watch?v='+id,{waitUntil:'domcontentloaded',timeout:45000});entry.status=response.status();
    await page.locator('video').first().waitFor({state:'attached',timeout:20000});
    await page.locator('video').first().evaluate(async video=>{video.muted=true;await video.play();});
    await page.waitForTimeout(25000);
    entry.player=await page.locator('video').first().evaluate(video=>({time:video.currentTime,paused:video.paused,readyState:video.readyState}));
    entry.saved=(await send({type:'list'})).videos.find(video=>video.videoId===id)||null;
    entry.pageMessage=await page.locator('body').innerText().then(text=>text.slice(0,350));
    await page.screenshot({path:path.join(output,'youtube-'+id+'.png')});
   }catch(error){entry.error=error.message;entry.pageMessage=await page.locator('body').innerText().then(text=>text.slice(0,500)).catch(()=>null);}
   await page.close();console.log('LIVE_YOUTUBE',JSON.stringify(entry));
  }
  report.checks.push('live YouTube attempts recorded separately from controlled pass/fail checks');
  await popup.reload();await popup.screenshot({path:path.join(output,'store-v'+report.version+'-popup.png')});
  console.log('STORE_RELEASE_PASS',JSON.stringify(report));
 }catch(error){report.error=error.message;console.error(error);process.exitCode=1;}
 finally{fs.writeFileSync(path.join(output,'store-release-results.json'),JSON.stringify(report,null,2));await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
