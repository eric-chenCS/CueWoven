const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');
const fs=require('fs'),path=require('path'),os=require('os');
const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-live-scenes-')),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')).version;
 const report={version,testedAt:new Date().toISOString(),environment:'Isolated Chromium; no user cookies/history; no mocked video/image/model responses',videoId:'jNQXAC9IVRw',sceneSaved:false};
 try {
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),base=`chrome-extension://${new URL(worker.url()).hostname}`;
  const options=await context.newPage();await options.goto(`${base}/options/options.html`);
  await options.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,dwellSeconds:0,maxAgeDays:0,speechEnabled:true,screenTextEnabled:false,scenesEnabled:true}}));
  const page=await context.newPage();await page.goto(`https://www.youtube.com/watch?v=${report.videoId}`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('video').waitFor({state:'attached'});await page.locator('video').click({force:true});
  await page.evaluate(()=>{const video=document.querySelector('video');video.currentTime=9;video.loop=true;return video.play()});
  const deadline=Date.now()+120000;
  do {
   const response=await options.evaluate(()=>chrome.runtime.sendMessage({type:'list'}));
   const saved=response.videos?.find(video=>video.sceneCount>0);
   if(saved){report.sceneSaved=true;report.spokenMethod=saved.method;if(!['history-title'].includes(saved.method))break;}
   await new Promise(resolve=>setTimeout(resolve,500));
  }while(Date.now()<deadline);
  if(report.sceneSaved){
   await page.evaluate(()=>document.querySelector('video').pause());
   const response=await options.evaluate(()=>chrome.runtime.sendMessage({type:'search',query:'a man standing in front of elephants at a zoo',singleVideo:true}));
   report.results=response.results?.map(({videoId,start,matchSources,scene})=>({videoId,start,matchSources,scene}));report.error=response.error||response.sceneError;
   const backup=await options.evaluate(()=>chrome.runtime.sendMessage({type:'export'}));report.snapshotBytes=backup.scenes?.[0]?.image.length;report.snapshotTime=backup.scenes?.[0]?.start;
  }
 }catch(error){report.error=error.message;}
 finally {
  if(process.env.RECALL_SCREENSHOT_DIR)fs.writeFileSync(path.join(process.env.RECALL_SCREENSHOT_DIR,`recall-v${version.split('.').slice(0,2).join('.')}-live-scenes.json`),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));await context.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1});
