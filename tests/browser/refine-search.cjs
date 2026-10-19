const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=process.env.RECALL_EXTENSION || path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-refine-')),{executablePath:process.env.RECALL_BROWSER,headless:true,viewport:{width:480,height:650},args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 const errors=[];
 try {
  await context.route('https://i.ytimg.com/**',route=>route.fulfill({status:404,body:''}));
  await context.addInitScript(()=>{
   if(!location.pathname.endsWith('/popup/popup.html'))return;
   window.searchCalls=[];
   const original=chrome.runtime.sendMessage.bind(chrome.runtime);
   chrome.runtime.sendMessage=async message=>{
    if(message.type==='status')return {videos:2,chunks:2,model:{status:'idle'}};
    if(message.type==='warmup')return {};
    if(message.type!=='search')return original(message);
    window.searchCalls.push(message);
    if(window.useRealSearch)return original(message);
    if(message.query.includes('old clue'))await new Promise(resolve=>window.releaseOld=resolve);
    return {results:[{videoId:'aaaaaaaaaaa',title:message.query,text:message.query,start:42,channel:'Controlled search fixture',score:0.8}]};
   };
  });
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const url=`chrome-extension://${new URL(worker.url()).hostname}/popup/popup.html`;
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url);
  const result=async query=>{
   await page.waitForFunction(query=>document.querySelector('.result .title')?.textContent===query,query);
   assert.equal(await page.locator('.result').getAttribute('href'),'https://www.youtube.com/watch?v=aaaaaaaaaaa&t=42s');
  };
  assert.equal(await page.locator('#refine').isVisible(),false,'details are offered only after a search');
  await page.locator('#q').fill('black holes');await page.locator('#q').press('Enter');await result('black holes');
  await page.locator('#q').fill('a trap');await page.locator('#q').press('Enter');await result('a trap');
  assert.equal(await page.evaluate(()=>searchCalls.at(-1).query),'a trap');
  // Keyboard opening and focus, then details that build up as removable tags.
  await page.locator('#refine-toggle').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'details');
  assert.equal(await page.locator('#refine-toggle').getAttribute('aria-expanded'),'true');
  await page.locator('#details').fill('Minecraft');await page.locator('#details').press('Enter');await result('a trap. Minecraft');
  await page.locator('#details').fill('with redstone');await page.locator('#details').press('Enter');
  await result('a trap. Minecraft. with redstone');
  assert.deepEqual(await page.locator('.clue > span').allInnerTexts(),['+ Minecraft','+ with redstone']);
  await page.locator('.chip[data-days="7"]').click();await result('a trap. Minecraft. with redstone');
  await page.waitForFunction(()=>searchCalls.at(-1).sinceDays===7);
  // Reopening defaults to an independent base query, without hidden previous clues.
  await page.reload();await page.locator('#q').press('Enter');await result('a trap');
  assert.equal(await page.locator('#refine-panel').isVisible(),false);
  assert.equal(await page.locator('#details').inputValue(),'');
  await page.locator('#refine-toggle').click();
  await page.locator('#details').fill('old clue');await page.locator('#details').press('Enter');
  await page.waitForFunction(()=>!!window.releaseOld);
  await page.locator('#q').fill('battery aging');await page.locator('#q').press('Enter');await result('battery aging');
  assert.equal(await page.locator('#refine-panel').isVisible(),false);
  assert.equal(await page.locator('#details').inputValue(),'');
  await page.evaluate(()=>window.releaseOld());await page.waitForTimeout(300);
  await result('battery aging');
  await page.locator('#refine-toggle').click();
  await page.locator('#details').fill('phone');await page.locator('#details').press('Enter');await result('battery aging. phone');
  await page.locator('.clue button').click();await result('battery aging');
  assert.equal(await page.locator('#clues').isVisible(),false);
  assert.equal(await page.locator('#details').inputValue(),'');
  await page.locator('#q').fill('');
  await page.waitForFunction(()=>document.querySelector('.empty'));
  await page.reload();
  assert.equal(await page.locator('#q').inputValue(),'');
  assert.equal(await page.locator('#refine').isVisible(),false);
  // Capture the actual popup layout in both themes and check for horizontal overflow.
  await page.locator('#q').fill('the video explaining a trap');await page.locator('#q').press('Enter');await result('the video explaining a trap');
  await page.locator('#refine-toggle').click();
  await page.locator('#details').fill('Minecraft, using redstone to move the floor');await page.locator('#details').press('Enter');
  await result('the video explaining a trap. Minecraft, using redstone to move the floor');
  const output=process.env.RECALL_SCREENSHOT_DIR || os.tmpdir();
  for(const colorScheme of ['light','dark']){
   await page.emulateMedia({colorScheme});
   assert.equal(await page.evaluate(()=>document.body.scrollWidth>document.body.clientWidth),false);
   await page.locator('body').screenshot({path:path.join(output,`recall-refine-${colorScheme}.png`)});
  }
  // Verify the combined query also goes through the real local model and ranker.
  await page.evaluate(async()=>{
   for(const [videoId,title,start,text] of [
    ['aaaaaaaaaaa','Minecraft trap tutorial',72,'In Minecraft, build a redstone trap by wiring sticky pistons underneath a moving floor. The floor retracts when another player steps on the pressure plate.'],
    ['bbbbbbbbbbb','Battery wear explained',42,'Repeated charging damages battery electrodes through chemical reactions. This makes a phone battery hold less charge and lose energy capacity as it gets older.'],
   ]){
    const response=await chrome.runtime.sendMessage({target:'offscreen',type:'index',method:'controlled-test',video:{videoId,title,channel:'Fixture',watchedAt:Date.now()},segments:[{start,text}]});
    if(response.error)throw Error(response.error);
   }
   window.useRealSearch=true;
  });
  await page.locator('#q').fill('the video about making a trap');await page.locator('#q').press('Enter');
  await page.locator('#refine-toggle').click();
  await page.locator('#details').fill('Minecraft redstone and a floor that moves');await page.locator('#details').press('Enter');
  await page.waitForFunction(()=>document.querySelector('.result .title')?.textContent==='Minecraft trap tutorial',null,{timeout:120000});
  await page.waitForFunction(()=>window.searchCalls.at(-1).query==='the video about making a trap. Minecraft redstone and a floor that moves');
  assert.equal(await page.locator('.result').first().getAttribute('href'),'https://www.youtube.com/watch?v=aaaaaaaaaaa&t=72s');
  await page.locator('#q').fill('why a phone battery holds less charge after repeated charging');await page.locator('#q').press('Enter');
  await page.waitForFunction(()=>document.querySelector('.result .title')?.textContent==='Battery wear explained',null,{timeout:30000});
  assert.equal(await page.locator('#refine-panel').isVisible(),false);
  assert.equal(await page.locator('.result').first().getAttribute('href'),'https://www.youtube.com/watch?v=bbbbbbbbbbb&t=42s');
  assert.deepEqual(errors,[]);
  console.log('REFINE_SEARCH_PASS: offered after a search, details build up as removable tags, keyboard controls, date filters, popup reopen, clearing, toggle-off and stale response protection. Controlled responses test UI races; real model and ranker find transcript fixtures at 1:12 and 0:42.');
 } finally {await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
