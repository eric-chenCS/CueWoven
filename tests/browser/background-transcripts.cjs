const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=process.env.RECALL_EXTENSION || path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-background-')),{executablePath:process.env.RECALL_BROWSER,headless:process.env.RECALL_HEADED!=='1',viewport:null,args:[...(process.env.RECALL_HEADED==='1'?['--start-minimized']:[]),`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 let release, gate=new Promise(resolve=>release=resolve), active=0,maxActive=0,captionRequests=0;
 const player=videoId=>({videoDetails:{videoId,title:`Battery science ${videoId}`,author:'Controlled fixture',lengthSeconds:'600'},captions:{playerCaptionsTracklistRenderer:{captionTracks:[{languageCode:'en',baseUrl:`https://www.youtube.com/api/timedtext?v=${videoId}`}]}}});
 await context.route('https://example.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>User browsing page</title><p>Main browser window</p>'}));
 await context.route('https://www.youtube.com/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/timedtext'){
   active++;maxActive=Math.max(active,maxActive);captionRequests++;
   await gate;await new Promise(resolve=>setTimeout(resolve,150));active--;
   return route.fulfill({contentType:'application/json',body:JSON.stringify({events:[
    {tStartMs:42000,segs:[{utf8:'Battery charging cycles damage electrodes and reduce phone energy capacity.'}]},
    {tStartMs:47000,segs:[{utf8:'Chemical reactions reduce the amount of charge the battery can store.'}]},
    {tStartMs:52000,segs:[{utf8:'The battery ages as these reactions continue over time.'}]},
   ]})});
  }
  if(url.pathname==='/watch')return route.fulfill({contentType:'text/html',body:`<!doctype html><title>Controlled YouTube fixture</title><script>window.ytInitialPlayerResponse=${JSON.stringify(player(url.searchParams.get('v')))}</script>`});
  return route.fulfill({status:404,body:''});
 });
 context.on('page',page=>{page.on('pageerror',e=>console.log('CAPTURE_SCRIPT_ERROR',page.url(),String(e)));page.on('domcontentloaded',async()=>{
  if(page.url().startsWith('https://www.youtube.com/watch'))await page.evaluate(data=>{window.ytInitialPlayerResponse=data;},player(new URL(page.url()).searchParams.get('v'))).catch(()=>{});
 });});
 try {
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const base=`chrome-extension://${new URL(worker.url()).hostname}`;
  let page=await context.newPage();await page.goto(`${base}/options/options.html`);
  assert.equal(await page.locator('#transcriptConcurrency').inputValue(),'6');
  await page.locator('#transcriptConcurrency').selectOption('6');
  await page.waitForFunction(async()=> (await chrome.storage.local.get('settings')).settings?.transcriptConcurrency===6);
  await page.reload();
  assert.equal(await page.locator('#transcriptConcurrency').inputValue(),'6');
  const mainWindow=(await page.evaluate(()=>chrome.tabs.getCurrent())).windowId;
  const userPage=await context.newPage();await userPage.goto('https://example.com/user-browsing');
  const mainBefore=await worker.evaluate(id=>chrome.windows.get(id),mainWindow);
  const entries=Array.from({length:8},(_,i)=>({header:'YouTube',title:`Watched Battery science ${i}`,titleUrl:`https://www.youtube.com/watch?v=${String(i).padStart(11,'a')}`,time:'2020-01-01T00:00:00Z'}));
  await page.locator('#takeout-import').setInputFiles({name:'watch-history.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(entries))});
  const wait=async predicate=>{const until=Date.now()+120000;while(!await predicate()){const job=(await worker.evaluate(()=>chrome.storage.session.get('transcriptJob'))).transcriptJob;if(job?.status==='interrupted')throw Error(JSON.stringify(job));if(Date.now()>until)throw Error('Background test timed out: '+JSON.stringify(job));await new Promise(resolve=>setTimeout(resolve,100));}};
  await wait(()=>captionRequests>=6);
  assert.equal(active,6);
  for(const message of [{type:'clear'},{type:'delete',videoId:'aaaaaaaaaa0'},{type:'import',data:{}}]){
   const blocked=await page.evaluate(message=>chrome.runtime.sendMessage(message),message);
   assert.match(blocked.error,/Pause transcript fetching/);
  }
  const tabs=await worker.evaluate(()=>chrome.tabs.query({url:'https://www.youtube.com/watch*'}));
  assert.equal(tabs.length,6);
  assert.ok(tabs.every(tab=>!tab.active&&tab.mutedInfo.muted),'capture tabs stay inactive and muted');
  assert.equal(new Set(tabs.map(t=>t.windowId)).size,1);
  const captureId=tabs[0].windowId;assert.notEqual(captureId,mainWindow);
  const capture=await worker.evaluate(id=>chrome.windows.get(id),captureId);
  assert.equal(capture.state,'minimized');assert.equal(capture.focused,false);
  assert.equal((await worker.evaluate(id=>chrome.windows.get(id),mainWindow)).focused,mainBefore.focused);
  assert.equal((await worker.evaluate(id=>chrome.tabs.query({windowId:id,url:'https://www.youtube.com/watch*'}),mainWindow)).length,0);
  for(const options of context.pages().filter(p=>p.url().includes('/options/options.html')))await options.close();
  release();
  await wait(async()=>((await worker.evaluate(()=>chrome.storage.session.get('transcriptJob'))).transcriptJob)?.status==='done');
  const finished=(await worker.evaluate(()=>chrome.storage.session.get('transcriptJob'))).transcriptJob;
  assert.equal(finished.done,8);assert.equal(finished.failed,0);assert.equal(maxActive,6);
  assert.equal(await worker.evaluate(id=>chrome.windows.get(id).then(()=>true,()=>false),captureId),false,'capture window closes when done');
  assert.equal((await worker.evaluate(()=>chrome.tabs.query({url:'https://www.youtube.com/watch*'}))).length,0);
  page=await context.newPage();await page.goto(`${base}/options/options.html`);
  await page.waitForFunction(()=>document.querySelector('#bulk-summary').textContent.startsWith('Finished:'));
  const saved=await page.evaluate(()=>chrome.runtime.sendMessage({type:'list'}));
  assert.ok(saved.videos.every(video=>video.historyImported===true),'background captions keep imported retention');assert.ok(finished.results.every(result=>result.title.startsWith('Battery science ')));
  assert.equal(saved.videos.length,8);assert.ok(saved.videos.every(v=>v.method!=='history-title'&&v.watchedAt===Date.parse('2020-01-01')));
  const search=await page.evaluate(()=>chrome.runtime.sendMessage({type:'search',query:'why a phone battery holds less charge over time'}));
  assert.equal(search.results[0].start,42);assert.equal(search.results[0].titleOnly,false);
  // A second job pauses after its six in-flight videos rather than starting the remaining three.
  gate=new Promise(resolve=>release=resolve);captionRequests=0;
  await page.locator('#bulk-urls').fill(Array.from({length:9},(_,i)=>`https://www.youtube.com/watch?v=${String(i+100).padStart(11,'a')}`).join('\n'));
  await page.locator('#bulk-go').click();await wait(()=>captionRequests>=6);
  await page.locator('#bulk-stop').click();release();
  await page.waitForFunction(()=>document.querySelector('#bulk-summary').textContent.startsWith('Paused:'),null,{timeout:120000});
  const paused=(await worker.evaluate(()=>chrome.storage.session.get('transcriptJob'))).transcriptJob;
  assert.equal(paused.done,6);assert.equal(paused.total-paused.completed,3);
  assert.equal((await worker.evaluate(()=>chrome.tabs.query({url:'https://www.youtube.com/watch*'}))).length,0);
  // Closing the capture window pauses promptly and does not recreate it.
  gate=new Promise(resolve=>release=resolve);captionRequests=0;
  await page.locator('#bulk-urls').fill(Array.from({length:9},(_,i)=>String(i+200).padStart(11,'a')).join('\n'));
  await page.locator('#bulk-go').click();await wait(()=>captionRequests>=6);
  const manual=(await worker.evaluate(()=>chrome.storage.session.get('captureWindow'))).captureWindow;
  await worker.evaluate(id=>chrome.windows.remove(id),manual.windowId);release();
  await page.waitForFunction(()=>document.querySelector('#bulk-summary').textContent.startsWith('Paused:'),null,{timeout:10000});
  const closed=(await worker.evaluate(()=>chrome.storage.session.get('transcriptJob'))).transcriptJob;
  assert.equal(closed.completed,6);assert.equal(closed.failed,6);assert.equal(closed.total-closed.completed,3);
  assert.equal((await worker.evaluate(()=>chrome.tabs.query({url:'https://www.youtube.com/watch*'}))).length,0);
  assert.equal((await worker.evaluate(()=>chrome.storage.session.get('captureWindow'))).captureWindow,undefined);
  // Already-indexed videos need no window at all.
  await page.locator('#bulk-urls').fill(entries.map(e=>e.titleUrl).join('\n'));await page.locator('#bulk-go').click();
  await page.waitForFunction(()=>document.querySelector('#bulk-summary').textContent.startsWith('Finished:'));
  const skipped=(await worker.evaluate(()=>chrome.storage.session.get('transcriptJob'))).transcriptJob;
  assert.equal(userPage.url(),'https://example.com/user-browsing');
  assert.equal(skipped.skipped,8);assert.equal((await worker.evaluate(()=>chrome.storage.session.get('captureWindow'))).captureWindow,undefined);
  // Keep the coalesced refresh optimization from v2.6.
  await page.evaluate(()=>{const send=chrome.runtime.sendMessage.bind(chrome.runtime);window.listReads=0;chrome.runtime.sendMessage=msg=>{if(msg.type==='list')listReads++;return send(msg)}});
  await worker.evaluate(()=>Promise.all(Array.from({length:30},()=>chrome.runtime.sendMessage({type:'index-changed'}))));
  await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>listReads),1);
  await page.locator('section').filter({has:page.locator('#transcriptConcurrency')}).screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR || os.tmpdir(),'recall-v2.7-settings.png')});
  console.log('BACKGROUND_TRANSCRIPTS_PASS: real service worker, six concurrent muted tabs in one separate minimized/unfocused window, settings closed while eight videos finish, restored progress, original dates, real-model search at 0:42, pause, manual window close without recreation, already-indexed skip, main-window isolation and cleanup. YouTube responses controlled.');
 } catch(error) {
  const worker=context.serviceWorkers()[0];
  if(worker)console.error('BACKGROUND_DIAGNOSTICS',JSON.stringify(await worker.evaluate(async()=>({state:await chrome.storage.session.get(['transcriptJob','captureWindow']),tabs:await chrome.tabs.query({url:'https://www.youtube.com/watch*'})})).catch(()=>({worker:'unavailable'}))));
  throw error;
 } finally {release();await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
