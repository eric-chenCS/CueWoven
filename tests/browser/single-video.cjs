const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=process.env.RECALL_EXTENSION || path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-single-')),{executablePath:process.env.RECALL_BROWSER,headless:true,viewport:{width:480,height:650},args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 const errors=[];
 try {
  await context.route('https://i.ytimg.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="128" height="72"><rect width="128" height="72" fill="#666"/></svg>'}));
  await context.addInitScript(()=>{
   if(!location.pathname.endsWith('/popup/popup.html'))return;
   const original=chrome.runtime.sendMessage.bind(chrome.runtime);
   chrome.runtime.sendMessage=async message=>{
    if(message.type==='search'&&window.holdNext&&message.offset===1){
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
   await chrome.storage.local.set({onboardingComplete:true,settings:{enabled:false,maxAgeDays:0,perVideo:3}});
   const ready=await chrome.runtime.sendMessage({type:'warmup'});
   if(ready?.error)throw Error(ready.error);
   for(let i=0;i<13;i++){
    const result=await chrome.runtime.sendMessage({target:'offscreen',type:'index',method:'controlled-test',
     video:{videoId:String(i).padStart(11,'a'),title:`Battery science ${i+1}`,channel:'Local fixture',watchedAt:i===0?Date.now():Date.parse('2020-01-01')},
     segments:[{start:42+i,text:`Battery charging cycles damage electrodes and reduce energy capacity. This phone battery loses stored charge as chemical reactions change its materials. Explanation number ${i+1}.`}]});
    if(result.error)throw Error(result.error);
   }
   const imported=await chrome.runtime.sendMessage({type:'import-history',videos:[{videoId:'zzzzzzzzzzz',title:'Battery charging and energy capacity',channel:'History fixture',watchedAt:Date.parse('2020-01-01')}]});
   if(imported.error)throw Error(imported.error);
  });
  const query='battery charging energy capacity';
  const expected=async(query,sinceDays=0)=>{
   const found=[];
   for(let offset=0;offset<20;offset++){
    const response=await options.evaluate(message=>chrome.runtime.sendMessage(message),{type:'search',query,sinceDays,singleVideo:true,offset});
    if(response.error)throw Error(response.error);
    if(!response.results.length)break;
    found.push(response.results[0]);
    if(response.results.length===1)break;
   }
   return found;
  };
  const ranked=await expected(query);
  assert.equal(ranked.length,14);assert.equal(new Set(ranked.map(r=>r.videoId)).size,14);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${base}/popup/popup.html`);
  const hit=async(result,label)=>{
   await page.waitForFunction(({title,label})=>document.querySelector('.result .title')?.textContent===title&&document.querySelector('#page-label').textContent===label,{title:result.title,label});
   assert.equal(await page.locator('.result').count(),1);
   const url=`https://www.youtube.com/watch?v=${result.videoId}${result.titleOnly?'':`&t=${Math.floor(result.start)}s`}`;
   assert.equal(await page.locator('.result').getAttribute('href'),url);
  };
  assert.equal(await page.locator('#single-video').isChecked(),true,'one-at-a-time is default');
  await page.locator('#q').fill(query);await hit(ranked[0],'Best match');
  assert.equal(await page.locator('#previous-video').isDisabled(),true);
  for(let i=1;i<ranked.length;i++){
   await page.locator('#next-video').click();await hit(ranked[i],`Match ${i+1}`);
  }
  assert.equal(await page.locator('#next-video').isDisabled(),true);
  await page.locator('#previous-video').click();await hit(ranked.at(-2),'Match 13');
  // New query/filters/refinement start at the strongest eligible video.
  const changed=await expected('battery electrodes');
  await page.locator('#q').fill('battery electrodes');await hit(changed[0],'Best match');
  await page.locator('.chip[data-days="1"]').click();
  const today=await expected('battery electrodes',1);assert.equal(today.length,1);
  await hit(today[0],'Best match');assert.equal(await page.locator('#next-video').isDisabled(),true);
  await page.locator('.chip[data-days="0"]').click();await hit(changed[0],'Best match');
  await page.locator('#refine-toggle').click();await page.locator('#details').fill('a phone losing energy');
  const refined=await expected('battery electrodes. a phone losing energy');
  await hit(refined[0],'Best match');
  await page.locator('#next-video').click();await hit(refined[1],'Match 2');
  await page.locator('#details').fill('chemical reactions');
  const refinedAgain=await expected('battery electrodes. chemical reactions');
  await hit(refinedAgain[0],'Best match');
  // A delayed next page must not overwrite a new query or re-enable stale navigation.
  await page.evaluate(()=>window.holdNext=true);await page.locator('#next-video').click();
  await page.waitForFunction(()=>!!window.releaseNext);
  assert.equal(await page.locator('#next-video').isDisabled(),true);
  assert.equal(await page.locator('#previous-video').isDisabled(),true);
  await page.locator('#q').fill(query);await hit(ranked[0],'Best match');
  await page.evaluate(()=>window.releaseNext());await page.waitForTimeout(300);await hit(ranked[0],'Best match');
  const output=process.env.RECALL_SCREENSHOT_DIR || os.tmpdir();
  for(const colorScheme of ['light','dark']){
   await page.emulateMedia({colorScheme});
   assert.equal(await page.evaluate(()=>document.body.scrollWidth>document.body.clientWidth),false);
   await page.locator('body').screenshot({path:path.join(output,`recall-single-${colorScheme}.png`)});
  }
  await page.locator('#single-video').uncheck();
  await page.waitForFunction(()=>document.querySelectorAll('.result').length===12);
  assert.equal(await page.locator('#result-pages').isVisible(),false);
  await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.result').length===12);
  assert.equal(await page.locator('#single-video').isChecked(),false,'list preference is remembered');
  await page.locator('#single-video').check();await hit(ranked[0],'Best match');
  await page.locator('#q').fill('');await page.waitForFunction(()=>document.querySelector('.empty'));
  assert.equal(await page.locator('#result-pages').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('SINGLE_VIDEO_PASS: real model/ranker, default single view, 14 distinct videos, timestamps/title-only URLs, next/previous boundaries, filters/refinement resets, stale page rejection, list opt-out and persistence. Transcript data is controlled.');
 } finally {await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
