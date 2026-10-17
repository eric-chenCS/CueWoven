const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=process.env.RECALL_EXTENSION || path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-background-')),{executablePath:process.env.RECALL_BROWSER,headless:true,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 let release = () => {}, openedCapture = 0;
 context.on('page',p=>{if(p.url().startsWith('https://www.youtube.com/'))openedCapture++;p.on('domcontentloaded',()=>{if(p.url().startsWith('https://www.youtube.com/'))openedCapture++})});
 try {
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await worker.evaluate(() => {
   const original = globalThis.fetch;
   globalThis.resetCaptions = () => { globalThis.captionRequests = 0;globalThis.activeCaptions = 0;globalThis.maxCaptions = 0;globalThis.captionGate = new Promise(resolve => globalThis.releaseCaptions = resolve); };
   resetCaptions();
   globalThis.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if(url.origin !== 'https://www.youtube.com') return original(input, options);
    const id=url.searchParams.get('v');
    if(url.pathname === '/watch')return new Response('<script>window.ytInitialPlayerResponse='+JSON.stringify({videoDetails:{videoId:id,title:'Battery science '+id,author:'Fixture'},captions:{playerCaptionsTracklistRenderer:{captionTracks:[{languageCode:'en',baseUrl:'https://www.youtube.com/api/timedtext?v='+id}]}}})+';</script>');
    if(url.pathname === '/api/timedtext') {
     captionRequests++;activeCaptions++;maxCaptions=Math.max(maxCaptions,activeCaptions);
     await captionGate;activeCaptions--;
     return new Response(JSON.stringify({events:[42,47,52].map(t=>({tStartMs:t*1000,segs:[{utf8:'Battery charging cycles damage electrodes and reduce phone energy capacity with chemical reactions over time.'}]}))}));
    }
    return new Response('',{status:404});
   };
  });
  release = () => worker.evaluate(() => releaseCaptions());
  const base=`chrome-extension://${new URL(worker.url()).hostname}`;
  let page=await context.newPage();await page.goto(`${base}/options/options.html`);
  assert.equal(await page.locator('#transcriptConcurrency').inputValue(),'6');
  assert.equal(await page.locator('#transcriptMode').inputValue(),'quiet');
  await page.locator('#transcriptConcurrency').selectOption('12');
  await page.waitForFunction(async()=> (await chrome.storage.local.get('settings')).settings?.transcriptConcurrency===12);
  await page.reload();
  assert.equal(await page.locator('#transcriptConcurrency').inputValue(),'12');
  const entries=Array.from({length:14},(_,i)=>({header:'YouTube',title:`Watched Battery science ${i}`,titleUrl:`https://www.youtube.com/watch?v=${String(i).padStart(11,'a')}`,time:'2020-01-01T00:00:00Z'}));
  await page.locator('#takeout-import').setInputFiles({name:'watch-history.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(entries))});
  const wait=async predicate=>{const until=Date.now()+120000;while(!await predicate()){if(Date.now()>until)throw Error('Background test timed out');await new Promise(resolve=>setTimeout(resolve,100));}};
  await wait(()=>worker.evaluate(()=>captionRequests>=12));
  assert.equal(await worker.evaluate(()=>activeCaptions),12);
  for(const message of [{type:'clear'},{type:'delete',videoId:'aaaaaaaaaa0'},{type:'import',data:{}}]){
   const blocked=await page.evaluate(message=>chrome.runtime.sendMessage(message),message);
   assert.match(blocked.error,/Pause transcript fetching/);
  }
  const tabs=await worker.evaluate(()=>chrome.tabs.query({url:'https://www.youtube.com/watch*'}));
  assert.equal(tabs.length,0,'quiet mode opens no YouTube tabs');
  assert.equal(openedCapture,0);
  for(const options of context.pages().filter(p=>p.url().includes('/options/options.html')))await options.close();
  await release();
  await wait(async()=>((await worker.evaluate(()=>chrome.storage.session.get('transcriptJob'))).transcriptJob)?.status==='done');
  const finished=(await worker.evaluate(()=>chrome.storage.session.get('transcriptJob'))).transcriptJob;
  assert.equal(finished.done,14);assert.equal(finished.failed,0);assert.equal(await worker.evaluate(()=>maxCaptions),12);
  assert.equal((await worker.evaluate(()=>chrome.tabs.query({url:'https://www.youtube.com/watch*'}))).length,0);
  page=await context.newPage();await page.goto(`${base}/options/options.html`);
  await page.waitForFunction(()=>document.querySelector('#bulk-summary').textContent.startsWith('Finished:'));
  const saved=await page.evaluate(()=>chrome.runtime.sendMessage({type:'list'}));
  assert.equal(saved.videos.length,14);assert.ok(saved.videos.every(v=>v.method!=='history-title'&&v.watchedAt===Date.parse('2020-01-01')));
  const search=await page.evaluate(()=>chrome.runtime.sendMessage({type:'search',query:'why a phone battery holds less charge over time'}));
  assert.equal(search.results[0].start,42);assert.equal(search.results[0].titleOnly,false);
  // A second job pauses after its twelve in-flight videos rather than starting the remaining three.
  await worker.evaluate(()=>resetCaptions());
  await page.locator('#bulk-urls').fill(Array.from({length:15},(_,i)=>`https://www.youtube.com/watch?v=${String(i+100).padStart(11,'a')}`).join('\n'));
  await page.locator('#bulk-go').click();await wait(()=>worker.evaluate(()=>captionRequests>=12));
  await page.locator('#bulk-stop').click();await release();
  await page.waitForFunction(()=>document.querySelector('#bulk-summary').textContent.startsWith('Paused:'),null,{timeout:120000});
  const paused=(await worker.evaluate(()=>chrome.storage.session.get('transcriptJob'))).transcriptJob;
  assert.equal(paused.done,12);assert.equal(paused.total-paused.completed,3);
  assert.equal((await worker.evaluate(()=>chrome.tabs.query({url:'https://www.youtube.com/watch*'}))).length,0);
  assert.equal(openedCapture,0,'no capture page opened during either job');
  // A burst of completed videos refreshes the 200-row library just once.
  await page.evaluate(async()=>{
   const send=chrome.runtime.sendMessage.bind(chrome.runtime);window.listReads=0;
   chrome.runtime.sendMessage=(msg)=>{if(msg.type==='list')listReads++;return send(msg)};

  });
  await worker.evaluate(()=>Promise.all(Array.from({length:30},()=>chrome.runtime.sendMessage({type:'index-changed'}))));
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(()=>listReads),1,'coalesced library refresh');
  // Blocking captions does not silently open tabs or lose the imported title.
  await worker.evaluate(()=>{const original=fetch;globalThis.fetch=(url,opts)=>String(url).startsWith('https://www.youtube.com/')?Promise.resolve(new Response('')):original(url,opts)});
  await page.locator('#takeout-import').setInputFiles({name:'watch-history.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify([{header:'YouTube',title:'Watched Requires its player',titleUrl:'https://www.youtube.com/watch?v=zzzzzzzzzzz',time:'2020-01-01T00:00:00Z'}]))});
  await page.waitForFunction(()=>document.querySelector('#bulk-summary').textContent.includes('1 failed'));
  const missing=await page.evaluate(()=>chrome.runtime.sendMessage({type:'list'}));
  assert.equal(missing.videos.find(v=>v.videoId==='zzzzzzzzzzz').method,'history-title');
  assert.equal(openedCapture,0);
  // Stop taking new work after YouTube explicitly rate limits requests.
  await worker.evaluate(()=>{const original=fetch;globalThis.fetch=(url,opts)=>String(url).startsWith('https://www.youtube.com/')?Promise.resolve(new Response('',{status:429})):original(url,opts)});
  await page.locator('#bulk-urls').fill(Array.from({length:30},(_,i)=>String(i+500).padStart(11,'a')).join('\n'));
  await page.locator('#bulk-go').click();
  await page.waitForFunction(()=>document.querySelector('#bulk-summary').textContent.startsWith('Paused:'));
  const limited=(await worker.evaluate(()=>chrome.storage.session.get('transcriptJob'))).transcriptJob;
  assert.ok(limited.completed<=12 && limited.failed>0 && limited.total>limited.completed);
  assert.equal(openedCapture,0);
  await page.locator('#transcriptMode').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR || os.tmpdir(),'recall-v2.6-settings.png'),fullPage:true});
  console.log('BACKGROUND_TRANSCRIPTS_PASS: real service worker, twelve concurrent HTTP requests with zero YouTube tabs, settings closed while fourteen videos finish, restored progress, original dates, real-model search at 0:42, pause after active videos and no-tab completion. YouTube responses controlled.');
 } finally {await release();await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
