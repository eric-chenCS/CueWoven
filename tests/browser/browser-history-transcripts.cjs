const {captureOptionsMessages,installControlledQueue}=require('./queue-fixture.cjs');
const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=process.env.RECALL_EXTENSION || path.resolve(__dirname,'../..');
(async()=>{
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'recall-history-extension-'));
 fs.cpSync(root,fixture,{recursive:true,filter:source=>{
  const relative=path.relative(root,source);
  return !relative.split(path.sep).some(p=>p==='node_modules'||p==='.git')&&!relative.endsWith('.zip');
 }});
 const manifest=JSON.parse(fs.readFileSync(path.join(fixture,'manifest.json'),'utf8'));
 manifest.permissions.push('history');delete manifest.optional_permissions;
 fs.writeFileSync(path.join(fixture,'manifest.json'),JSON.stringify(manifest));
 console.log('TEST ONLY: browser history permission pregranted in fixture; production permission prompt unchanged.');
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-history-auto-')),{executablePath:process.env.RECALL_BROWSER,headless:true,args:[`--disable-extensions-except=${fixture}`,`--load-extension=${fixture}`]});
 const errors=[];
 try {
  await captureOptionsMessages(context);
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/options/options.html`);
  await page.evaluate(async()=>{
   // A previously saved video outside the scan must not be queued by Add all.
   const existing=await chrome.runtime.sendMessage({type:'import-history',videos:[{videoId:'unrelated00',title:'Unrelated saved title',channel:'Fixture',watchedAt:Date.parse('2020-01-01')}]});
   if(existing.error)throw Error(existing.error);
   for(let i=0;i<53;i++)await chrome.history.addUrl({url:`https://www.youtube.com/watch?v=${String(i).padStart(11,'a')}`});
  });
  await installControlledQueue(page);
  await page.locator('#history-scan').click();
  await page.waitForFunction(()=>document.querySelector('#history-msg').textContent.includes('53 unique'));
  const scanned=await page.evaluate(()=>chrome.runtime.sendMessage({type:'history-videos',days:90}));
  assert.equal(await page.locator('#browser-transcripts').isChecked(),true);
  await page.locator('#history-save').click();
  await page.waitForFunction(()=>document.querySelector('#history-msg').textContent.startsWith('Finished:'),null,{timeout:180000});
  assert.match(await page.locator('#history-msg').innerText(),/1 indexed, 52 failed. 0 not attempted/);
  assert.equal(await page.evaluate(()=>bulkCalls.length),53,'all 53 scanned videos attempted');
  assert.equal(await page.evaluate(()=>bulkCalls.includes('unrelated00')),false);
  const first=await page.evaluate(()=>bulkCalls[0]);
  const list=await page.evaluate(()=>chrome.runtime.sendMessage({type:'list'}));
  assert.equal(list.videos.length,54);
  assert.equal(list.videos.filter(v=>v.method==='history-title').length,53,'failed captions keep titles');
  assert.equal(list.videos.find(v=>v.videoId===first).watchedAt,scanned.videos.find(v=>v.videoId===first).lastVisitTime);
  const search=await page.evaluate(()=>chrome.runtime.sendMessage({type:'search',query:'why does a phone battery hold less charge over time'}));
  assert.equal(search.results[0].videoId,first);assert.equal(search.results[0].start,42);
  // Duplicate Add all skips complete transcripts; title-only opt-out starts no queue.
  await page.locator('#browser-transcripts').uncheck();await page.locator('#history-save').click();
  await page.waitForFunction(()=>document.querySelector('#history-msg').textContent.startsWith('Added 0'));
  assert.equal(await page.evaluate(()=>bulkCalls.length),53);
  assert.equal(await page.locator('#bulk-stop').isVisible(),false);
  await page.locator('#browser-transcripts').check();await page.evaluate(()=>window.testMode='hold');
  await page.locator('#history-save').click();await page.waitForFunction(()=>!!window.releaseBulk);
  assert.equal(await page.evaluate(first=>bulkCalls.at(-1)===first,first),false,'existing transcript skipped');
  assert.equal(await page.locator('#browser-transcripts').isDisabled(),true);
  assert.equal(await page.locator('#history-save').isDisabled(),true);
  await page.locator('#bulk-stop').click();await page.evaluate(()=>window.releaseBulk());
  await page.waitForFunction(()=>document.querySelector('#history-msg').textContent.startsWith('Paused:'));
  assert.match(await page.locator('#history-msg').innerText(),/46 not attempted/);
  assert.equal(await page.evaluate(()=>bulkCalls.length),59);
  assert.equal(await page.locator('#history-save').isEnabled(),true);
  await page.locator('[aria-labelledby="history-heading"]').screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR || os.tmpdir(),'recall-history-auto-transcripts.png')});
  assert.deepEqual(errors,[]);
  console.log('BROWSER_HISTORY_TRANSCRIPTS_PASS: real 53-video browser-history scan, default automatic transcripts, no truncation, scoped queue, failure preservation, visit dates, transcript search at 0:42, opt-out, duplicate skip and pause. Caption outcomes controlled.');
 } finally {await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
