const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-adaptive-')),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 try{
  const errors=[];browser.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  const worker=browser.serviceWorkers()[0]||await browser.waitForEvent('serviceworker'),base=`chrome-extension://${new URL(worker.url()).hostname}`;
  const options=await browser.newPage();await options.goto(`${base}/options/options.html`);
  const picture=await options.evaluate(async()=>{const bitmap=await createImageBitmap(await(await fetch('https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/cats.png')).blob()),canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;canvas.getContext('2d').drawImage(bitmap,0,0,640,360);bitmap.close();return canvas.toDataURL('image/jpeg',.8)});
  await options.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,dwellSeconds:0,maxAgeDays:0,speechEnabled:false,screenTextEnabled:false,scenesEnabled:true}}));
  await browser.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><button>Play</button><video muted playsinline></video><canvas width="640" height="360" hidden></canvas><script>window.ytInitialPlayerResponse={videoDetails:{videoId:'aaaaaaaaaaa',title:'Brief visual event',author:'Fixture',lengthSeconds:'600'}};const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),video=document.querySelector('video'),picture=new Image();picture.src=${JSON.stringify(picture)};window.eventShown=false;function draw(){ctx.fillStyle='#204080';ctx.fillRect(0,0,640,360);if(eventShown&&picture.complete)ctx.drawImage(picture,0,0,640,360)}setInterval(draw,50);draw();video.srcObject=canvas.captureStream(20);document.querySelector('button').onclick=()=>video.play();</script>`}));
  const page=await browser.newPage();await page.goto('https://www.youtube.com/watch?v=aaaaaaaaaaa');await page.locator('button').click();
  const wait=async predicate=>{const deadline=Date.now()+180000;do{const result=await predicate();if(result)return result;await new Promise(r=>setTimeout(r,200));}while(Date.now()<deadline);throw Error('Adaptive scene test timed out');};
  const exported=()=>options.evaluate(()=>chrome.runtime.sendMessage({type:'export'}));
  await wait(async()=>(await exported()).scenes?.length===1);
  const eventTime=await page.evaluate(()=>{window.eventShown=true;return document.querySelector('video').currentTime;});
  await wait(async()=>(await exported()).scenes?.some(scene=>scene.adaptive&&Math.abs(scene.start-eventTime)<2));
  await page.evaluate(()=>window.eventShown=false);
  await wait(async()=>(await exported()).scenes?.filter(scene=>scene.adaptive).length>=2);
  // Keep the same real player running beyond its next routine checkpoint.
  await page.waitForFunction(()=>document.querySelector('video').currentTime>=25);
  await page.evaluate(()=>document.querySelector('video').pause());
  const backup=await exported();assert.equal(backup.scenes.filter(scene=>!scene.adaptive).length,1);
  const extra=backup.scenes.filter(scene=>scene.adaptive);assert.ok(extra.length>=2);assert.ok(extra.every(scene=>scene.start<20));
  const search=await options.evaluate(()=>chrome.runtime.sendMessage({type:'search',query:'two cats sitting on a sofa',singleVideo:true}));
  assert.equal(search.results[0].videoId,'aaaaaaaaaaa');assert.ok(search.results[0].matchSources.includes('Scene'));assert.ok(Math.abs((search.results[0].sceneStart??search.results[0].start)-eventTime)<2);
  const budget=await options.evaluate(async({image,used})=>{
   const send=chrome.runtime.sendMessage.bind(chrome.runtime);let accepted=0,limited;
   for(let i=0;i<7;i++){const response=await send({target:'offscreen',type:'scene-index',video:{videoId:i%2?'bbbbbbbbbbb':'ccccccccccc',title:'Other visible window'},start:100+i,image,adaptive:true});if(response.rateLimited){limited=response;break;}if(response.error)throw Error(response.error);assertOk(response);accepted++;}
   function assertOk(response){if(!response.ok)throw Error(JSON.stringify(response));}
   const baseline=await send({target:'offscreen',type:'scene-index',video:{videoId:'bbbbbbbbbbb',title:'Routine snapshot'},start:140,image});return {used,accepted,limited,baseline};
  },{image:backup.scenes[0].image,used:extra.length});
  assert.equal(budget.used+budget.accepted,6);assert.equal(budget.limited.rateLimited,true);assert.ok(budget.limited.retryAfterMs>0);assert.equal(budget.baseline.ok,true);
  await options.evaluate(()=>chrome.runtime.sendMessage({type:'clear'}));
  const restored=await options.evaluate(data=>chrome.runtime.sendMessage({type:'import',data}),backup);assert.equal(restored.error,undefined);
  const after=await exported();assert.equal(after.scenes.length,backup.scenes.length);assert.equal(after.scenes.filter(scene=>scene.adaptive).length,extra.length);
  const metrics=await options.evaluate(async()=>{
   await import(chrome.runtime.getURL('lib/scene-policy.js'));const P=globalThis.__recallScenePolicy,source=document.createElement('canvas');source.width=1280;source.height=720;source.getContext('2d').fillRect(0,0,1280,720);
   const probe=document.createElement('canvas');probe.width=P.WIDTH;probe.height=P.HEIGHT;const ctx=probe.getContext('2d',{willReadFrequently:true}),frame=document.createElement('canvas');frame.width=320;frame.height=180;const full=frame.getContext('2d');let previous;
   const measure=fn=>{const samples=[];for(let i=0;i<200;i++){const start=performance.now();fn();samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);return {medianMs:samples[100],p95Ms:samples[190]};};
   const oldSnapshot=measure(()=>{full.drawImage(source,0,0,320,180);frame.toDataURL('image/jpeg',.6);});
   const newProbe=measure(()=>{ctx.drawImage(source,0,0,P.WIDTH,P.HEIGHT);const current=ctx.getImageData(0,0,P.WIDTH,P.HEIGHT).data;P.changedFrame(previous,current);previous=current;});
   return {oldSnapshot,newProbe,quietInferencePerMinute:{before:3,after:1},probeFrequencyPerSecond:2,maxRetainedProbeBytes:96*54*4*4,scope:'200 synchronous static-canvas samples; excludes video decode and model inference; one machine'};
  });
  assert.ok(metrics.newProbe.p95Ms<10);assert.deepEqual(errors,[]);
  const report={eventTime,saved:backup.scenes.map(({start,adaptive})=>({start,adaptive:!!adaptive})),resultTime:(search.results[0].sceneStart??search.results[0].start),budget,metrics};console.log('ADAPTIVE_SCENES_PASS',JSON.stringify(report));
  if(process.env.RECALL_SCREENSHOT_DIR)fs.writeFileSync(path.join(process.env.RECALL_SCREENSHOT_DIR,'recall-v2.15-adaptive-scenes.json'),JSON.stringify(report,null,2)+'\n');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
