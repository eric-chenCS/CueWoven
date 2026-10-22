// Optional real audio-capture regression on controlled YouTube pages; no microphone or user profile.
const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 assert.ok(process.env.RECALL_SPEECH_WAV,'Set RECALL_SPEECH_WAV to a spoken audio fixture');
 assert.ok(process.env.RECALL_SPEECH_MODEL_DIR,'Set RECALL_SPEECH_MODEL_DIR to a cached whisper-tiny.en folder');
 const report={controlledPages:true,realAudioCapture:true,realWhisper:true,checks:[],errors:[]};
 const f=await fixture({prepareExtension(extension){
  fs.cpSync(process.env.RECALL_SPEECH_MODEL_DIR,path.join(extension,'test-models/Xenova/whisper-tiny.en'),{recursive:true});
  const file=path.join(extension,'offscreen/speech-worker.js');
  fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/env.allowLocalModels\s*=\s*false;/,"env.allowLocalModels=true;env.allowRemoteModels=false;env.localModelPath=new URL('../test-models/',import.meta.url).href;").replace(/env.useBrowserCache\s*=\s*true;/,'env.useBrowserCache=false;'));
 }});
 f.context.on('weberror',event=>report.errors.push(event.error().message));
 try{
  await f.options.evaluate(()=>chrome.storage.local.set({onboardingComplete:true,liteModeInitialized:true,settings:{enabled:true,lightMode:false,speechEnabled:true,dwellSeconds:0,maxAgeDays:0,screenTextEnabled:false,scenesEnabled:false,articleImagesEnabled:false}}));
  await f.context.route('https://www.youtube.com/**',route=>{
   const url=new URL(route.request().url()),id=url.searchParams.get('v');
   if(url.pathname==='/fixture.wav')return route.fulfill({contentType:'audio/wav',body:fs.readFileSync(process.env.RECALL_SPEECH_WAV)});
   if(url.pathname==='/api/timedtext')return route.fulfill({contentType:'application/json',body:url.searchParams.has('late')?JSON.stringify({events:[{tStartMs:1000,segs:[{utf8:'Battery charging cycles damage the electrodes and reduce energy capacity.'}]},{tStartMs:5000,segs:[{utf8:'Chemical reactions explain why a phone battery stores less charge over time.'}]},{tStartMs:9000,segs:[{utf8:'Recall saves the words you actually hear while watching a video.'}]}]}):''});
   if(url.pathname!=='/watch')return route.fulfill({status:404,body:''});
   const player={videoDetails:{videoId:id,title:'Battery audio '+id,author:'Fixture',defaultAudioLanguage:'en',lengthSeconds:'500'},captions:{playerCaptionsTracklistRenderer:{captionTracks:[{languageCode:'en',baseUrl:'https://www.youtube.com/api/timedtext?v='+id}]}}};
   return route.fulfill({contentType:'text/html',body:`<!doctype html><title>Battery audio</title><script>window.ytInitialPlayerResponse=${JSON.stringify(player)}</script><button id="play" onclick="document.querySelector('video').play()">Play</button><video style="width:640px;height:360px" controls loop src="/fixture.wav"></video><button id="late" onclick="fetch('/api/timedtext?v=${id}&late=1')">Late captions</button>`});
  });
  const open=async id=>{const page=await f.context.newPage();await page.goto('https://www.youtube.com/watch?v='+id);await page.bringToFront();await page.locator('#play').click();return page;};
  const bounded=(work,label)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(label+' timed out')),15000);work.then(resolve,reject).finally(()=>clearTimeout(timer));});
  const state=()=>bounded(f.send({type:'speech-status'}),'speech status'),records=()=>bounded(f.send({type:'list'}),'library list');
  const page=await open('lateaud0001');
  console.log('SPEECH_CHECK: waiting for automatic capture and a real saved speech segment');
  let previous;
  await f.wait(async()=>{const s=await state(),progress=s.status+':'+s.saved;if(progress!==previous){previous=progress;console.log('SPEECH_STATE',JSON.stringify(s));}if(s.status==='idle'&&s.reason)throw Error(JSON.stringify(s));return s.status==='recording'&&s.saved>0;});
  const active=await state();assert.equal((await records()).videos.find(v=>v.videoId==='lateaud0001').method,'speech-local');
  assert.equal(await f.worker.evaluate(tabId=>chrome.action.getBadgeText({tabId}),active.tabId),'STT');
  const speechBackup=await f.send({type:'export'});assert.match(speechBackup.videos.find(v=>v.videoId==='lateaud0001').chunks.map(c=>c.text).join(' '),/battery|charg|energy/i);
  report.checks.push('normal Play automatically captures actual player audio through AudioWorklet, Whisper and MiniLM; speech saved and STT badge visible');
  await page.locator('#late').click();
  console.log('SPEECH_CHECK: late caption response delivered');
  await f.wait(async()=>{const s=await state(),v=(await records()).videos.find(v=>v.videoId==='lateaud0001');return s.status==='idle'&&v?.method==='player-captions';});
  assert.match((await state()).reason,/Captions were saved/);
  assert.notEqual(await f.worker.evaluate(tabId=>chrome.action.getBadgeText({tabId}),active.tabId),'STT');
  assert.equal(await page.locator('video').evaluate(v=>v.paused),false,'speech cancellation must preserve playback');
  await page.waitForTimeout(2000);assert.equal((await state()).status,'idle');
  const result=await f.send({type:'search',query:'"Battery charging cycles damage the electrodes"',videoId:'lateaud0001'});
  assert.equal(result.results[0].videoId,'lateaud0001');assert.deepEqual(result.results[0].matchSources,['Transcript']);
  report.checks.push('late captions replace speech, stop STT badge, preserve playback, stay stopped and remain searchable as Transcript');
  await page.close();
  const endedPage=await open('endaud00001');await f.wait(async()=>(await state()).status==='recording');
  console.log('SPEECH_CHECK: ending a second video with buffered audio');
  await endedPage.waitForTimeout(3500);
  await endedPage.locator('video').evaluate(v=>{v.loop=false;v.currentTime=v.duration-.2;return v.play();});
  await endedPage.waitForFunction(()=>document.querySelector('video').ended);
  await f.wait(async()=>(await state()).status==='idle');assert.match((await state()).reason,/ended or changed/);
  const endedVideo=(await records()).videos.find(v=>v.videoId==='endaud00001');assert.equal(endedVideo?.method,'speech-local');assert.ok(endedVideo.chunkCount>0,'ordinary ending must flush heard speech');
  report.checks.push('ordinary playback end still flushes real buffered speech and returns idle');
  assert.deepEqual(report.errors,[]);report.pass=true;console.log('SPEECH_LATE_CAPTIONS_PASS',JSON.stringify(report));
 }catch(error){report.error=error.stack;report.state=await f.send({type:'speech-status'}).catch(()=>null);report.capture=await f.worker.evaluate(async()=>{const tabs=await chrome.tabs.query({url:'https://www.youtube.com/watch*'});return Promise.all(tabs.map(async tab=>({active:tab.active,id:tab.id,url:tab.url,context:await chrome.tabs.sendMessage(tab.id,{type:'speech-context'}).catch(e=>({error:e.message})),video:await chrome.tabs.sendMessage(tab.id,{type:'get-video'}).catch(e=>({error:e.message}))})));}).catch(()=>null);throw error;}
 finally{if(process.env.RECALL_REPORT_DIR){fs.mkdirSync(process.env.RECALL_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR,'speech-late-captions.json'),JSON.stringify(report,null,2));}await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
