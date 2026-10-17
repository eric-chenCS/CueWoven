// Optional network check: actual public YouTube playback, no caption/audio fixtures.
const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');
const fs=require('fs'),path=require('path'),os=require('os');
const root=process.env.RECALL_EXTENSION || path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-live-speech-')),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 const report={version:'2.8.0',testedAt:new Date().toISOString(),environment:'Isolated Chromium; no user cookies or history',videoId:'jNQXAC9IVRw',automaticSpeechSaved:false};
 try {
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const options=await context.newPage();await options.goto(`chrome-extension://${new URL(worker.url()).hostname}/options/options.html`);
  await options.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,dwellSeconds:5,maxAgeDays:0,speechEnabled:true}}));
  const page=await context.newPage();await page.goto(`https://www.youtube.com/watch?v=${report.videoId}`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('video').waitFor({state:'attached',timeout:30000});
  await page.locator('video').click({force:true});
  await page.evaluate(()=>{const video=document.querySelector('video');video.loop=true;return video.play()});
  const deadline=Date.now()+180000;
  do {
   const listed=await options.evaluate(()=>chrome.runtime.sendMessage({type:'list'}));
   const saved=listed?.videos?.find(v=>v.videoId===report.videoId);
   if(saved){report.method=saved.method;report.chunkCount=saved.chunkCount;report.automaticSpeechSaved=saved.method==='speech-local';break;}
   const state=await options.evaluate(()=>chrome.runtime.sendMessage({type:'speech-status'}));
   if(state.status==='idle'&&state.reason){report.reason=state.reason;break;}
   await new Promise(resolve=>setTimeout(resolve,500));
  } while(Date.now()<deadline);
  report.player=await page.evaluate(()=>{const v=document.querySelector('video');return {time:v.currentTime,paused:v.paused,readyState:v.readyState,audioTracksExposed:typeof v.captureStream==='function'}});
  if(report.automaticSpeechSaved){
   const result=await options.evaluate(()=>chrome.runtime.sendMessage({type:'search',query:'elephants at the zoo'}));
   report.searchVideoId=result.results?.[0]?.videoId;report.timestamp=result.results?.[0]?.start;
   report.aiSpeechLabel=result.results?.[0]?.speechGenerated;
  }
 } catch(error){report.error=error.message;}
 finally {
  if(process.env.RECALL_SCREENSHOT_DIR)fs.writeFileSync(path.join(process.env.RECALL_SCREENSHOT_DIR,'recall-v2.8-live-speech.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));await context.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1});
