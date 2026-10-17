const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=process.env.RECALL_EXTENSION || path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-live-quiet-')),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 let youtubePages=0;context.on('page',p=>p.on('domcontentloaded',()=>{if(p.url().startsWith('https://www.youtube.com/'))youtubePages++}));
 try {
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const page=await context.newPage();
  await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/options/options.html`);
  await page.locator('#bulk-urls').fill('https://www.youtube.com/watch?v=jNQXAC9IVRw');await page.locator('#bulk-go').click();
  await page.waitForFunction(()=>document.querySelector('#bulk-summary').textContent.startsWith('Finished:'),null,{timeout:120000});
  const job=(await worker.evaluate(()=>chrome.storage.session.get('transcriptJob'))).transcriptJob;
  const tabs=await worker.evaluate(()=>chrome.tabs.query({url:'https://www.youtube.com/*'}));
  assert.equal(youtubePages,0);assert.equal(tabs.length,0);assert.equal(job.mode,'quiet');assert.equal(job.completed,1);
  const report={version:'2.6.0',testedAt:new Date().toISOString(),environment:'Isolated Chromium; no user cookies/history',videoId:'jNQXAC9IVRw',mode:job.mode,youtubePagesOpened:youtubePages,liveCaptionSuccess:job.done===1,results:job.results};
  if(process.env.RECALL_SCREENSHOT_DIR)fs.writeFileSync(path.join(process.env.RECALL_SCREENSHOT_DIR,'recall-v2.6-live-test.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
 }finally{await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
