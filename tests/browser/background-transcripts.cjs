const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=process.env.RECALL_EXTENSION || path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-background-')),{executablePath:process.env.RECALL_BROWSER,headless:true,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 let release, gate=new Promise(resolve=>release=resolve), active=0,maxActive=0,captionRequests=0;
 const player=videoId=>({videoDetails:{videoId,title:`Battery science ${videoId}`,author:'Controlled fixture',lengthSeconds:'600'},captions:{playerCaptionsTracklistRenderer:{captionTracks:[{languageCode:'en',baseUrl:`https://www.youtube.com/api/timedtext?v=${videoId}`}]}}});
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
 context.on('page',page=>page.on('domcontentloaded',async()=>{
  if(page.url().startsWith('https://www.youtube.com/watch'))await page.evaluate(data=>{window.ytInitialPlayerResponse=data;},player(new URL(page.url()).searchParams.get('v'))).catch(()=>{});
 }));
 try {
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const base=`chrome-extension://${new URL(worker.url()).hostname}`;
  let page=await context.newPage();await page.goto(`${base}/options/options.html`);
  assert.equal(await page.locator('#transcriptConcurrency').inputValue(),'6');
  await page.locator('#transcriptConcurrency').selectOption('12');
  await page.waitForFunction(async()=> (await chrome.storage.local.get('settings')).settings?.transcriptConcurrency===12);
  await page.reload();
  assert.equal(await page.locator('#transcriptConcurrency').inputValue(),'12');
  const entries=Array.from({length:14},(_,i)=>({header:'YouTube',title:`Watched Battery science ${i}`,titleUrl:`https://www.youtube.com/watch?v=${String(i).padStart(11,'a')}`,time:'2020-01-01T00:00:00Z'}));
  await page.locator('#takeout-import').setInputFiles({name:'watch-history.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(entries))});
  const wait=async predicate=>{const until=Date.now()+120000;while(!await predicate()){if(Date.now()>until)throw Error('Background test timed out');await new Promise(resolve=>setTimeout(resolve,100));}};
  await wait(()=>captionRequests>=12);
  assert.equal(active,12);
  for(const message of [{type:'clear'},{type:'delete',videoId:'aaaaaaaaaa0'},{type:'import',data:{}}]){
   const blocked=await page.evaluate(message=>chrome.runtime.sendMessage(message),message);
   assert.match(blocked.error,/Pause transcript fetching/);
  }
  const tabs=await worker.evaluate(()=>chrome.tabs.query({url:'https://www.youtube.com/watch*'}));
  assert.ok(tabs.every(tab=>!tab.active&&tab.mutedInfo.muted),'capture tabs stay inactive and muted');
  for(const options of context.pages().filter(p=>p.url().includes('/options/options.html')))await options.close();
  release();
  await wait(async()=>((await worker.evaluate(()=>chrome.storage.session.get('transcriptJob'))).transcriptJob)?.status==='done');
  const finished=(await worker.evaluate(()=>chrome.storage.session.get('transcriptJob'))).transcriptJob;
  assert.equal(finished.done,14);assert.equal(finished.failed,0);assert.equal(maxActive,12);
  assert.equal((await worker.evaluate(()=>chrome.tabs.query({url:'https://www.youtube.com/watch*'}))).length,0);
  page=await context.newPage();await page.goto(`${base}/options/options.html`);
  await page.waitForFunction(()=>document.querySelector('#bulk-summary').textContent.startsWith('Finished:'));
  const saved=await page.evaluate(()=>chrome.runtime.sendMessage({type:'list'}));
  assert.equal(saved.videos.length,14);assert.ok(saved.videos.every(v=>v.method!=='history-title'&&v.watchedAt===Date.parse('2020-01-01')));
  const search=await page.evaluate(()=>chrome.runtime.sendMessage({type:'search',query:'why a phone battery holds less charge over time'}));
  assert.equal(search.results[0].start,42);assert.equal(search.results[0].titleOnly,false);
  // A second job pauses after its twelve in-flight videos rather than starting the remaining three.
  gate=new Promise(resolve=>release=resolve);captionRequests=0;
  await page.locator('#bulk-urls').fill(Array.from({length:15},(_,i)=>`https://www.youtube.com/watch?v=${String(i+100).padStart(11,'a')}`).join('\n'));
  await page.locator('#bulk-go').click();await wait(()=>captionRequests>=12);
  await page.locator('#bulk-stop').click();release();
  await page.waitForFunction(()=>document.querySelector('#bulk-summary').textContent.startsWith('Paused:'),null,{timeout:120000});
  const paused=(await worker.evaluate(()=>chrome.storage.session.get('transcriptJob'))).transcriptJob;
  assert.equal(paused.done,12);assert.equal(paused.total-paused.completed,3);
  assert.equal((await worker.evaluate(()=>chrome.tabs.query({url:'https://www.youtube.com/watch*'}))).length,0);
  console.log('BACKGROUND_TRANSCRIPTS_PASS: real service worker, twelve concurrent inactive/muted capture tabs, settings closed while fourteen videos finish, restored progress, original dates, real-model search at 0:42, pause after active videos and tab cleanup. YouTube responses controlled.');
 } finally {release();await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
