// Optional public-player check. No user profile, cookies, history or mocked responses.
const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright'),fs=require('fs'),path=require('path'),os=require('os');
const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-live-ocr-')),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 const report={version:JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')).version,testedAt:new Date().toISOString(),videoId:'FvBBB_PXFIU',environment:'Isolated Chromium, real public YouTube player, no user data or mocked responses',saved:false};
 const watchdog=setTimeout(()=>{report.error='Public player check exceeded 75 seconds.';context.close().catch(()=>{});},75000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),base=`chrome-extension://${new URL(worker.url()).hostname}`,options=await context.newPage();await options.goto(`${base}/options/options.html`);await options.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,dwellSeconds:0,maxAgeDays:0,speechEnabled:false,scenesEnabled:false,screenTextEnabled:true}}));
  const video=await context.newPage();await video.goto('https://www.youtube.com/watch?v='+report.videoId,{waitUntil:'domcontentloaded',timeout:30000});await video.locator('video').waitFor({state:'attached',timeout:15000});await video.locator('video').click({force:true});
  await video.evaluate(()=>{const media=document.querySelector('video');media.muted=true;media.currentTime=620;return Promise.race([media.play(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Playback did not start within 5 seconds.')),5000))])});
  const deadline=Date.now()+30000;do{const data=await options.evaluate(()=>chrome.runtime.sendMessage({type:'export'}));const text=data.screenText?.find(row=>row.videoId===report.videoId);if(text){report.saved=true;report.text=text.text;report.start=text.start;break;}await new Promise(resolve=>setTimeout(resolve,500));}while(Date.now()<deadline);
  report.playback=await video.evaluate(()=>{const media=document.querySelector('video');return {time:media.currentTime,paused:media.paused,width:media.videoWidth,ad:!!document.querySelector('.ad-showing,.ad-interrupting')}});
 }catch(error){report.error=error.message;}
 finally{clearTimeout(watchdog);if(process.env.RECALL_SCREENSHOT_DIR)fs.writeFileSync(path.join(process.env.RECALL_SCREENSHOT_DIR,'recall-live-screen-text.json'),JSON.stringify(report,null,2)+'\n');console.log('LIVE_SCREEN_TEXT',JSON.stringify(report));await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
