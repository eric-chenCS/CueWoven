const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=process.env.RECALL_EXTENSION || path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-auto-speech-')),{headless:true,executablePath:process.env.RECALL_BROWSER,viewport:{width:900,height:700},args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 const errors=[];
 await context.route('https://www.youtube.com/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/recall-test.wav')return route.fulfill({contentType:'audio/wav',body:fs.readFileSync(process.env.RECALL_SPEECH_WAV)});
  if(url.pathname==='/watch')return route.fulfill({contentType:'text/html',body:`<!doctype html><title>Audio science - YouTube</title><button id="play" onclick="document.querySelector('video').play()">Play video</button><video controls loop src="/recall-test.wav"></video><script>window.ytInitialPlayerResponse={videoDetails:{videoId:'aaaaaaaaaaa',title:'Audio science',author:'Fixture'}};const element=document.querySelector('video');</script>`});
  return route.fulfill({status:404,body:''});
 });
 context.on('page',p=>p.on('pageerror',e=>errors.push(String(e))));
 try {
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const base=`chrome-extension://${new URL(worker.url()).hostname}`;
  const options=await context.newPage();await options.goto(`${base}/options/options.html`);
  const waitState=async status=>{
   const deadline=Date.now()+120000;let current;
   do {current=await options.evaluate(()=>chrome.runtime.sendMessage({type:'speech-status'}));if(current.status===status)return current;await new Promise(r=>setTimeout(r,100));} while(Date.now()<deadline);
   throw Error(`Expected ${status}, received ${JSON.stringify(current)}`);
  };
  await options.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,dwellSeconds:5,maxAgeDays:0,speechEnabled:true}}));
  const video=await context.newPage();await video.goto('https://www.youtube.com/watch?v=aaaaaaaaaaa');await video.locator('#play').click();
  const until=Date.now()+180000;let state;
  while(Date.now()<until){
   state=await worker.evaluate(()=>chrome.runtime.sendMessage({target:'offscreen',type:'speech-status'}));
   if(state?.saved>0)break;
   if(state?.reason&&state.status==='idle')throw Error('Automatic speech failed: '+JSON.stringify(state));
   await new Promise(r=>setTimeout(r,500));
  }
  assert.ok(state?.saved>0,'automatic speech should save heard words without a speech-button click');
  console.log('AUTO_SPEECH_SAVED',JSON.stringify(state));
  const records=await options.evaluate(()=>chrome.runtime.sendMessage({type:'list'}));const saved=records.videos.find(v=>v.videoId==='aaaaaaaaaaa');
  assert.equal(saved.historyImported,false);assert.equal(saved.method,'speech-local');assert.equal(saved.partial,true);assert.ok(saved.watchedAt>Date.now()-120000);
  const exported=await options.evaluate(()=>chrome.runtime.sendMessage({type:'export'}));const chunks=exported.videos.find(v=>v.videoId==='aaaaaaaaaaa').chunks;
  console.log('AUTO_SPEECH_CHUNKS',JSON.stringify(chunks));
  assert.ok(chunks.length&&chunks.every(c=>c.start>=0&&c.start<15));
  assert.match(chunks.map(c=>c.text).join(' '),/battery|recall|video|charge|energy/i);
  const search=await options.evaluate(()=>chrome.runtime.sendMessage({type:'search',query:'remember the words heard while watching a video'}));
  assert.equal(search.results[0].videoId,'aaaaaaaaaaa');assert.ok(search.results[0].start>=0);
  assert.equal(search.results[0].speechGenerated,true);
  // Popup is opened as an extension page in this harness; point its tab query at the video.
  const target=(await worker.evaluate(()=>chrome.tabs.query({url:'https://www.youtube.com/watch*'})))[0];
  await context.addInitScript(target=>{if(location.pathname.endsWith('/popup/popup.html')){const query=chrome.tabs.query.bind(chrome.tabs);chrome.tabs.query=q=>q.active?Promise.resolve([target]):query(q)}},target);
  const popup=await context.newPage();await popup.goto(`${base}/popup/popup.html`);
  await popup.waitForFunction(()=>document.querySelector('#speech-status').textContent.startsWith('Listening'));
  await popup.locator('#speech').screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR||os.tmpdir(),'recall-auto-speech.png')});
  await popup.locator('#speech-stop').click();await popup.waitForFunction(()=>document.querySelector('#speech-stop').hidden,null,{timeout:120000});
  const stopped=await options.evaluate(()=>chrome.runtime.sendMessage({type:'speech-status'}));assert.equal(stopped.status,'idle');
  // A backup retains the partial marker and audio-range metadata after re-embedding.
  const backup=await options.evaluate(()=>chrome.runtime.sendMessage({type:'export'}));
  const restored=await options.evaluate(async data=>{await chrome.runtime.sendMessage({type:'clear'});const result=await chrome.runtime.sendMessage({type:'import',data});if(result.error)throw Error(result.error);return chrome.runtime.sendMessage({type:'export'})},backup);
  assert.equal(restored.videos[0].partial,true);assert.equal(restored.videos[0].method,'speech-local');
  assert.deepEqual(restored.videos[0].chunks,backup.videos[0].chunks);
  const dbChecks=await options.evaluate(async()=>{
   const db=await import(chrome.runtime.getURL('lib/db.js'));
   const video={videoId:'bbbbbbbbbbb',title:'Append fixture',watchedAt:10};
   const chunk=(start,text)=>({videoId:video.videoId,start,text,vec:new Float32Array(384)});
   await db.replaceVideo({...video,method:'history-title',historyImported:true},[chunk(0,'title')]);
   await db.appendSpeechVideo(video,[chunk(10,'first')],10,20);
   await db.appendSpeechVideo(video,[chunk(30,'second')],30,40);
   await db.appendSpeechVideo({...video,watchedAt:5},[chunk(10,'replacement')],10,20);
   const appended=await db.chunksOf(video.videoId),record=await db.getVideo(video.videoId);
   // Concurrent speech writes serialize; a full caption replacement always wins.
   await Promise.all([db.appendSpeechVideo(video,[chunk(50,'late speech')],50,60),db.replaceVideo({...video,method:'captions'},[chunk(42,'full captions')])]);
   const skipped=await db.appendSpeechVideo(video,[chunk(70,'must not overwrite')],70,80);
   return {texts:appended.map(c=>c.text).sort(),record,skipped,final:(await db.chunksOf(video.videoId)).map(c=>c.text)};
  });
  assert.deepEqual(dbChecks.texts,['replacement','second']);assert.equal(dbChecks.record.chunkCount,2);assert.equal(dbChecks.record.watchedAt,10);assert.equal(dbChecks.record.historyImported,false);
  assert.equal(dbChecks.skipped.skipped,true);assert.deepEqual(dbChecks.final,['full captions']);
  // A manual start can override wrong non-English metadata; automatic starts cannot.
  await video.evaluate(()=>{window.ytInitialPlayerResponse.videoDetails.defaultAudioLanguage='es';window.postMessage({source:'recall-bridge',type:'hello'},location.origin)});
  await popup.waitForFunction(async tabId=>(await chrome.tabs.sendMessage(tabId,{type:'speech-context'})).video.audioLanguage==='es',target.id);
  // An actual player end must stop capture without using the popup's Stop button.
  await video.bringToFront();await video.locator('#play').click();
  await popup.locator('#speech-start').click();
  await popup.waitForFunction(()=>document.querySelector('#speech-status').textContent.startsWith('Listening'),null,{timeout:120000});
  await waitState('recording');
  await video.evaluate(()=>{const v=document.querySelector('video');v.loop=false;v.currentTime=v.duration-0.2;v.play()});
  await video.waitForFunction(()=>document.querySelector('video').ended);
  const ended=await waitState('idle');assert.match(ended.reason,/ended or changed/);
  // Switching off the setting also stops an active stream immediately.
  await video.evaluate(()=>{const v=document.querySelector('video');v.currentTime=0;v.loop=true});
  await video.locator('#play').click();
  await popup.locator('#speech-start').click();
  await popup.waitForFunction(()=>document.querySelector('#speech-status').textContent.startsWith('Listening'),null,{timeout:120000});
  await waitState('recording');
  await options.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,speechEnabled:false}}));
  const disabled=await waitState('idle');assert.match(disabled.reason,/switched off/);
  assert.deepEqual(errors,[]);
  console.log('AUTO_SPEECH_PASS: automatic fallback after normal Play; local Whisper + MiniLM; partial AI labels; timestamps; append/rewatch/full-caption races; Stop, ended and settings-off cleanup.');
 }finally{await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
