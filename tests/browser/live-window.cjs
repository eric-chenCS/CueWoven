const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=process.env.RECALL_EXTENSION || path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-live-window-')),{headless:process.env.RECALL_HEADED!=='1',viewport:null,executablePath:process.env.RECALL_BROWSER,args:['--start-minimized',`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 try {
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const page=await context.newPage();
  await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/options/options.html`);
  const mainId=(await page.evaluate(()=>chrome.tabs.getCurrent())).windowId;
  await page.locator('#bulk-urls').fill('https://www.youtube.com/watch?v=jNQXAC9IVRw');await page.locator('#bulk-go').click();
  const until=Date.now()+120000;let observed=null,job;
  do {
   const {captureWindow,transcriptJob}=await worker.evaluate(()=>chrome.storage.session.get(['captureWindow','transcriptJob']));job=transcriptJob;
   if(captureWindow){const win=await worker.evaluate(id=>chrome.windows.get(id).catch(()=>null),captureWindow.windowId);if(win?.state==='minimized')observed={state:win.state,focused:win.focused,windowId:win.id};}
   if(job && !['running','pausing'].includes(job.status))break;
   await new Promise(r=>setTimeout(r,200));
  }while(Date.now()<until);
  assert.ok(job && job.completed===1);assert.ok(observed);assert.equal(observed.state,'minimized');assert.equal(observed.focused,false);
  assert.equal((await worker.evaluate(id=>chrome.tabs.query({windowId:id,url:'https://www.youtube.com/watch*'}),mainId)).length,0);
  assert.equal((await worker.evaluate(()=>chrome.storage.session.get('captureWindow'))).captureWindow,undefined);
  const report={version:'2.7.0',testedAt:new Date().toISOString(),environment:'Isolated Chromium; no user cookies/history',videoId:'jNQXAC9IVRw',captureWindow:observed,mainWindowCaptureTabs:0,windowClosedAfterJob:true,liveCaptionSuccess:job.done===1,results:job.results};
  if(process.env.RECALL_SCREENSHOT_DIR)fs.writeFileSync(path.join(process.env.RECALL_SCREENSHOT_DIR,'recall-v2.7-live-test.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
 }finally{await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
