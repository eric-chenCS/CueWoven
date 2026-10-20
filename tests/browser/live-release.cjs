// Public network smoke checks: no routed pages, injected captions, or substituted models.
const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(process.env.RECALL_EXTENSION||path.join(__dirname,'../..')),output=process.env.RECALL_SCREENSHOT_DIR||os.tmpdir();
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(process.env.RECALL_TEST_ROOT||os.tmpdir(),'cuewoven-live-')),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`,'--autoplay-policy=no-user-gesture-required']});
 const report={version:JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version,cases:[]};
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),base='chrome-extension://'+new URL(worker.url()).hostname;
  const options=await context.newPage();await options.goto(base+'/options/options.html');
  const send=msg=>options.evaluate(msg=>chrome.runtime.sendMessage(msg),msg);
  await context.addInitScript(()=>{window.captureMessages=[];window.addEventListener('message',event=>{if(event.data?.source==='recall-main'){const data=event.data;captureMessages.push({type:data.type,videoId:data.video?.videoId,audioLanguage:data.video?.audioLanguage,segments:data.segments?.length,error:data.error});if(captureMessages.length>30)captureMessages.shift();}});});
  await options.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,dwellSeconds:20,maxAgeDays:0,speechEnabled:true,scenesEnabled:false,screenTextEnabled:false,articleImagesEnabled:false}}));
  await send({type:'status'});
  for(const [id,goal,query] of [['jNQXAC9IVRw','speech-local','elephants have long trunks'],['aircAruvnKk','captions-or-speech','neural network neurons']]){
   if(process.env.RECALL_LIVE_CASE&&process.env.RECALL_LIVE_CASE!==id)continue;
   const entry={videoId:id,goal},page=await context.newPage();report.cases.push(entry);
   console.log('LIVE_CHECK',id,goal);
   try{
    const response=await page.goto('https://www.youtube.com/watch?v='+id,{waitUntil:'domcontentloaded',timeout:45000});entry.http=response.status();
    await page.locator('video').first().waitFor({state:'attached',timeout:25000});
    await page.locator('video').first().evaluate(async video=>{video.muted=true;await video.play();});
    const adDeadline=Date.now()+45000;
    while(await page.locator('#movie_player.ad-showing, #movie_player.ad-interrupting').count()){
      if(Date.now()>adDeadline)throw Error('Pre-roll ad did not finish in the test window.');
      const skip=page.locator('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern').first();
      if(await skip.isVisible().catch(()=>false))await skip.click({timeout:1000}).catch(()=>{});
      await page.waitForTimeout(500);
    }
    if(goal==='speech-local')await page.locator('video').first().evaluate(video=>{video.loop=true;});
    const started=Date.now(),deadline=started+150000;let last='';
    do{
     const saved=(await send({type:'list'})).videos.find(row=>row.videoId===id);
     const speech=await send({type:'speech-status'});
     const progress=JSON.stringify({method:saved?.method,speech:speech.status,reason:speech.reason,error:speech.error});
     if(progress!==last){console.log('LIVE_PROGRESS',id,progress);last=progress;}
     entry.saved=saved;entry.speech={status:speech.status,reason:speech.reason,error:speech.error};
     if(goal==='speech-local'&&speech.status==='idle'&&Date.now()-started>10000&&!entry.manualRequested){
      entry.manualRequested=true;const popup=await context.newPage();await popup.goto(base+'/popup/popup.html');await page.bringToFront();
      const tab=await worker.evaluate(async id=>(await chrome.tabs.query({})).find(tab=>tab.url?.includes('v='+id)),id);
      entry.manualResult=await popup.evaluate(tabId=>chrome.runtime.sendMessage({type:'speech-start',tabId}),tab.id);console.log('MANUAL_SPEECH_START',JSON.stringify(entry.manualResult));await popup.close();await page.bringToFront();
      if(entry.manualResult.status==='recording')await page.locator('video').first().evaluate(async video=>{video.loop=false;video.currentTime=0;await video.play();});
     }
     if(saved?.method&&saved.method!=='history-title')break;
     await page.waitForTimeout(1000);
    }while(Date.now()<deadline);
    entry.player=await page.locator('video').first().evaluate(video=>({time:video.currentTime,paused:video.paused,readyState:video.readyState,loop:video.loop}));
    entry.captureMessages=await page.evaluate(()=>captureMessages);
    if(entry.saved?.method==='speech-local')await page.waitForTimeout(22000);
    const search=await send({type:'search',query});entry.matches=search.results?.slice(0,3).map(row=>({videoId:row.videoId,start:row.start,speechGenerated:row.speechGenerated}));
    entry.captionsAvailable=!!entry.saved?.method&&!['history-title','speech-local'].includes(entry.saved.method);
    entry.passed=(goal==='speech-local'?entry.saved?.method==='speech-local':entry.captionsAvailable||entry.saved?.method==='speech-local')&&entry.matches?.some(hit=>hit.videoId===id);
    await page.screenshot({path:path.join(output,'live-'+id+'.png')});
   }catch(error){entry.error=error.message;entry.passed=false;}
   await page.close();console.log('LIVE_RESULT',JSON.stringify(entry));
  }
 }finally{fs.writeFileSync(path.join(output,'live-release-results.json'),JSON.stringify(report,null,2));await context.close();}
 if(report.cases.some(entry=>!entry.passed))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
