const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict');
(async()=>{const f=await fixture(),errors=[];try{
 await f.context.addInitScript(()=>{
  if(!location.pathname.endsWith('/popup/popup.html'))return;
  window.queries=[];window.opened=[];window.close=()=>{};
  chrome.tabs.create=async data=>{opened.push(data);return {id:999}};
  const original=chrome.runtime.sendMessage.bind(chrome.runtime);
  chrome.runtime.sendMessage=async msg=>{
   if(msg.type==='status')return {videos:2,chunks:2,model:{status:'ready'}};
   if(msg.type==='warmup')return {};
   if(msg.type!=='search')return original(msg);
   queries.push(msg);
   if(msg.query==='slow query')await new Promise(resolve=>window.releaseSlow=resolve);
   return {results:[{videoId:'aaaaaaaaaaa',title:msg.query,text:'Controlled result',start:42},{videoId:'bbbbbbbbbbb',title:'Another match',text:'Other result',start:80}]};
  };
 });
 const page=await f.context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(f.base+'/popup/popup.html');
 await page.waitForFunction(()=>document.querySelector('#start-choice').hidden);
 const count=()=>page.evaluate(()=>queries.length);
 const result=title=>page.waitForFunction(title=>document.querySelector('.result .title')?.textContent===title,title);
 await page.locator('#q').fill('coffee clue');await page.waitForTimeout(400);assert.equal(await count(),0);assert.equal(await page.locator('.result').count(),0);
 assert.equal(await page.locator('.empty h2').innerText(),'Press Enter to search');
 await page.locator('.chip[data-days="7"]').click();await page.locator('#kind-filter').selectOption('video');assert.equal(await count(),0,'filters cannot submit draft text');
 await page.locator('#q').press('Enter');await result('coffee clue');assert.equal(await count(),1);assert.equal(await page.evaluate(()=>opened.length),0,'first Enter shows results without opening');
 await page.locator('#next-video').click();await page.waitForFunction(()=>document.querySelector('#page-label').textContent==='Match 2');
 await page.locator('#q').fill('another clue');await page.waitForTimeout(400);assert.equal(await count(),2);assert.equal(await page.locator('.result').count(),0);
 await page.locator('#refine-toggle').click();await page.locator('#details').fill('more context');await page.locator('#details').press('Shift+Enter');await page.waitForTimeout(300);assert.equal(await count(),2,'refinement typing and Shift+Enter do not search');
 await page.locator('#details').press('Enter');await result('another clue. more context');assert.equal(await count(),3);
 await page.locator('#refine-toggle').click();assert.equal(await page.locator('.result').count(),0);assert.equal(await count(),3,'closing changed refinement waits for Enter');
 await page.locator('#q').press('Enter');await result('another clue');
 await page.locator('#q').press('Enter');assert.equal(await page.evaluate(()=>opened.length),1,'second Enter opens shown match');
 await page.locator('#q').fill('slow query');await page.locator('#q').press('Enter');await page.waitForFunction(()=>!!window.releaseSlow);
 await page.locator('#q').fill('new unfinished query');const before=await count();await page.evaluate(()=>releaseSlow());await page.waitForTimeout(400);assert.equal(await count(),before);assert.equal(await page.locator('.result').count(),0,'late reply cannot show matches while typing');
 await page.locator('#q').press('Enter');await result('new unfinished query');
 await page.reload();await page.waitForFunction(()=>document.querySelector('#q').value==='new unfinished query');await page.waitForTimeout(400);assert.equal(await count(),0);assert.equal(await page.locator('.result').count(),0,'restored query waits for Enter');
 await page.locator('#q').press('Enter');await result('new unfinished query');
 await page.locator('#q').fill('');assert.equal(await page.locator('.result').count(),0);assert.deepEqual(errors,[]);
 console.log('ENTER_SEARCH_PASS: no requests or matches while typing/refining; filters respect drafts; first Enter displays; second opens; arrows work; stale replies rejected; reopened query waits; clearing works.');
}finally{await f.close()}})().catch(e=>{console.error(e);process.exitCode=1});
