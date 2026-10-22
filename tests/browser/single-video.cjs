const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=process.env.RECALL_EXTENSION || path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(process.env.RECALL_TEST_ROOT||os.tmpdir(),'recall-single-')),{executablePath:process.env.RECALL_BROWSER,headless:true,viewport:{width:480,height:650},args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 const errors=[];
 try {
  await context.route('https://i.ytimg.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="128" height="72"><rect width="128" height="72" fill="#666"/></svg>'}));
  await context.addInitScript(()=>{
   if(!location.pathname.endsWith('/popup/popup.html'))return;
   const original=chrome.runtime.sendMessage.bind(chrome.runtime);
   chrome.runtime.sendMessage=async message=>{
    if(message.type==='search'&&window.holdNext&&message.offset===12){
     window.holdNext=false;
     await new Promise(resolve=>window.releaseNext=resolve);
    }
    return original(message);
   };
  });
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const base=`chrome-extension://${new URL(worker.url()).hostname}`;
  const options=await context.newPage();await options.goto(`${base}/options/options.html`);
  await options.evaluate(async()=>{
   await chrome.storage.local.set({onboardingComplete:true,settings:{enabled:true,lightMode:true,maxAgeDays:0,perVideo:3}});
   const ready=await chrome.runtime.sendMessage({type:'warmup'});
   if(ready?.error)throw Error(ready.error);
   for(let i=0;i<13;i++){
    const result=await chrome.runtime.sendMessage({target:'offscreen',type:'index',method:'controlled-test',
     video:{videoId:String(i).padStart(11,'a'),title:`Battery science ${i+1}`,channel:'Local fixture',watchedAt:i===0?Date.now():Date.parse('2020-01-01')},
     segments:[{start:42+i,text:`Battery charging cycles damage electrodes and reduce energy capacity. This phone battery loses stored charge as chemical reactions change its materials. Explanation number ${i+1}.`}]});
    if(result.error)throw Error(result.error);
   }
   const imported=await chrome.runtime.sendMessage({target:'offscreen',type:'import-history',videos:[{videoId:'zzzzzzzzzzz',title:'Battery charging and energy capacity',channel:'History fixture',watchedAt:Date.parse('2020-01-01')}]});
   if(imported.error)throw Error(imported.error);
  });
  const query='battery charging energy capacity';
  // The engine's distinct-video ranking, page by page, is what the popup should show in order.
  const expected=async(query,sinceDays=0)=>{
   const found=[];
   for(let offset=0;;offset+=12){
    const response=await options.evaluate(message=>chrome.runtime.sendMessage(message),{type:'search',query,sinceDays,distinct:true,offset});
    if(response.error)throw Error(response.error);
    found.push(...response.results);
    if(response.results.length<12)break;
   }
   return found;
  };
  const ranked=await expected(query);
  assert.equal(ranked.length,14);assert.equal(new Set(ranked.map(r=>r.videoId)).size,14);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${base}/popup/popup.html`);
  const href=result=>`https://www.youtube.com/watch?v=${result.videoId}${result.titleOnly?'':`&t=${Math.floor(result.start)}s`}`;
  // The best match as the big card, then `rows` other videos in ranked order.
  const shows=async(list,rows)=>{
   const want=list.slice(0,1+rows).map(href);
   await page.waitForFunction(best=>document.querySelector('.best .result')?.getAttribute('href')===best,want[0]);
   // Other matches start folded unless the engine is unsure; open them to compare the ranking.
   if(rows&&await page.locator('.others-head').getAttribute('aria-expanded')==='false')await page.locator('.others-head').click();
   await page.waitForFunction(want=>JSON.stringify([...document.querySelectorAll('.result')].map(a=>a.getAttribute('href')))===JSON.stringify(want),want);
   assert.equal(await page.locator('.best .result').getAttribute('href'),want[0]);
   assert.equal(await page.locator('.compact').count(),rows);
  };
  assert.equal(await page.locator('#single-video').count(),0,'one layout, no view toggle');
  await page.locator('#q').fill(query);await page.locator('#q').press('Enter');await shows(ranked,3);
  assert.equal(await page.locator('.others-head').innerText(),'OTHER MATCHES');assert.equal(await page.locator('.others-head').getAttribute('aria-expanded'),'true');
  await page.locator('.show-more').click();await shows(ranked,11);
  await page.locator('.show-more').click();await shows(ranked,13);
  assert.equal(await page.locator('.show-more').count(),0,'the last page hides Show more');
  // New query/filters/refinement start again from the strongest eligible video.
  const changed=await expected('battery electrodes');
  await page.locator('#q').fill('battery electrodes');await page.locator('#q').press('Enter');await shows(changed,3);
  await page.locator('.chip[data-days="1"]').click();
  const today=await expected('battery electrodes',1);assert.equal(today.length,1);
  await shows(today,0);assert.equal(await page.locator('.others-head').count(),0);assert.equal(await page.locator('.show-more').count(),0);
  await page.locator('.chip[data-days="0"]').click();await shows(changed,3);
  if(!await page.locator('#details').isVisible())await page.locator('#refine-toggle').click();
  await page.locator('#details').fill('a phone losing energy');await page.locator('#details').press('Enter');
  await shows(await expected('battery electrodes. a phone losing energy'),3);
  await page.locator('.clue button').click();
  await page.locator('#details').fill('chemical reactions');await page.locator('#details').press('Enter');
  await shows(await expected('battery electrodes. chemical reactions'),3);
  // A delayed "Show more" page must not add rows to a newer search.
  await page.evaluate(()=>window.holdNext=true);
  await page.locator('#q').fill(query);await page.locator('#q').press('Enter');await shows(ranked,3);
  await page.locator('.show-more').click();await shows(ranked,11);
  await page.locator('.show-more').click();await page.waitForFunction(()=>!!window.releaseNext);
  await page.locator('#q').fill('battery electrodes');await page.locator('#q').press('Enter');await shows(changed,3);
  await page.evaluate(()=>window.releaseNext());await page.waitForTimeout(300);await shows(changed,3);
  const output=process.env.RECALL_SCREENSHOT_DIR || os.tmpdir();
  for(const colorScheme of ['light','dark']){
   await page.emulateMedia({colorScheme});
   assert.equal(await page.evaluate(()=>document.body.scrollWidth>document.body.clientWidth),false);
   await page.locator('body').screenshot({path:path.join(output,`recall-single-${colorScheme}.png`)});
  }
  await page.locator('#q').fill('');await page.waitForFunction(()=>document.querySelector('.empty'));
  assert.equal(await page.locator('.best').count(),0);
  assert.deepEqual(errors,[]);
  console.log('SINGLE_VIDEO_PASS: real model/ranker, best match plus other videos in ranked order, Show more across a second page of 14 distinct videos, timestamps/title-only URLs, filters/refinement resets and stale page rejection. Transcript data is controlled.');
 } finally {await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
