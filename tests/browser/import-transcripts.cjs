const {captureOptionsMessages,installControlledQueue}=require('./queue-fixture.cjs');
const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=process.env.RECALL_EXTENSION || path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(require('node:os').tmpdir(),'recall-import-transcripts-')),{executablePath:process.env.RECALL_BROWSER || path.resolve(__dirname,'../../../browsers/chromium-1234/chrome-win64/chrome.exe'),headless:true,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 const errors=[];
 try {
  await captureOptionsMessages(context);
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id=new URL(worker.url()).hostname;
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`chrome-extension://${id}/options/options.html`);
  await installControlledQueue(page);
  const entries=Array.from({length:53},(_,i)=>({header:'YouTube',title:`Watched fixture ${i}`,titleUrl:`https://www.youtube.com/watch?v=${String(i).padStart(11,'a')}`,time:new Date(Date.UTC(2020,0,i+1)).toISOString()}));
  const file={name:'watch-history.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(entries))};
  assert.equal(await page.locator('#takeout-transcripts').isChecked(),true);
  await page.locator('#takeout-import').setInputFiles(file);
  await page.waitForFunction(()=>document.querySelector('#bulk-summary').textContent.startsWith('Finished:'),null,{timeout:180000});
  await page.waitForFunction(()=>!document.querySelector('#takeout-import').disabled);
  assert.match(await page.locator('#bulk-summary').innerText(),/1 indexed, 52 failed. 0 not attempted/);
  assert.equal(await page.evaluate(()=>bulkCalls.length),53,'history queue must not truncate at 50');
  assert.equal(await page.evaluate(()=>bulkCalls[0]),'aaaaaaaaa52','newest watched video first');
  const list=await page.evaluate(()=>chrome.runtime.sendMessage({type:'list'}));
  assert.equal(list.videos.length,53);assert.equal(list.videos.filter(v=>v.method==='history-title').length,52);
  assert.equal(list.videos.find(v=>v.videoId==='aaaaaaaaa52').watchedAt,Date.parse(entries[52].time));
  const search=await page.evaluate(()=>chrome.runtime.sendMessage({type:'search',query:'why does a phone battery hold less energy after charging many times'}));
  assert.equal(search.results[0].start,42);assert.equal(search.results[0].titleOnly,false);
  // Pausing finishes the in-flight videoss and does not start the next one.
  await page.evaluate(()=>window.testMode='hold');
  await page.locator('#history-transcripts').click();
  await page.waitForFunction(()=>!!window.releaseBulk);
  assert.equal(await page.locator('#clear').isDisabled(),true);
  assert.equal(await page.locator('#history-transcripts').isDisabled(),true);
  await page.locator('#bulk-stop').click();
  await page.evaluate(()=>window.releaseBulk());
  await page.waitForFunction(()=>document.querySelector('#bulk-summary').textContent.startsWith('Paused:'));
  await page.waitForFunction(()=>!document.querySelector('#takeout-import').disabled);
  assert.equal(await page.evaluate(()=>bulkCalls.length),56);
  assert.match(await page.locator('#bulk-summary').innerText(),/49 not attempted/);
  // Reopening the page rebuilds the remaining queue from persisted title-only records.
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#history-transcripts').disabled);
  assert.match(await page.locator('#history-transcripts').innerText(),/49/);
  // Title-only opt-out leaves the queue untouched, including on duplicate imports.
  await page.locator('#takeout-transcripts').uncheck();
  await page.locator('#takeout-import').setInputFiles(file);
  await page.waitForFunction(()=>document.querySelector('#history-import-msg').textContent.startsWith('Added 0'));
  await page.waitForFunction(()=>!document.querySelector('#takeout-import').disabled);
  assert.equal(await page.locator('#bulk-stop').isVisible(),false);
  assert.equal(context.pages().some(p=>p.url().includes('youtube.com/watch')),false);
  await page.screenshot({path:path.join(require('node:os').tmpdir(),'recall-v2.1-import.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('IMPORT_TRANSCRIPTS_PASS: automatic queue, 53 videos, failure preservation, original watch date, real transcript search at 0:42, pause, persisted remaining count, title-only opt-out. Caption outcomes controlled.');
 } finally {await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
