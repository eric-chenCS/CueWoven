const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright'),fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-demo-fixes-')),{headless:true,executablePath:process.env.RECALL_BROWSER,viewport:{width:480,height:700},args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 try{
  await context.addInitScript(()=>{
   if(!location.pathname.endsWith('/popup/popup.html'))return;
   window.calls=[];window.opened=[];window.closes=0;window.close=()=>closes++;
   chrome.tabs.create=async data=>{opened.push(data);return {id:999}};
   const send=chrome.runtime.sendMessage.bind(chrome.runtime);
   chrome.runtime.sendMessage=async message=>{
    calls.push(message);
    if(message.type==='status')return {videos:2,chunks:2,scenes:1,model:{status:'ready'}};
    if(message.type==='warmup')return {ok:true};
    if(message.type!=='search')return send(message);
    if(message.query==='old slow')await new Promise(resolve=>window.releaseOld=resolve);
    const id=message.query.startsWith('new')||message.offset>0?'bbbbbbbbbbb':'aaaaaaaaaaa';
    const hit={videoId:id,title:message.query,start:42,text:'Battery science',score:.8};return {results:[hit,{...hit,videoId:'ccccccccccc'}]};
   };
  });
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),page=await context.newPage();await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/popup/popup.html`);
  await page.waitForFunction(()=>calls.some(call=>call.type==='warmup'));assert.equal(await page.evaluate(()=>calls.find(call=>call.type==='warmup').scenes),true);
  await page.locator('#q').fill('first');await page.waitForSelector('.result');await page.locator('#q').press('Enter');
  await page.waitForFunction(()=>opened.length===1);assert.match((await page.evaluate(()=>opened[0])).url,/v=aaaaaaaaaaa&t=42s/);assert.equal(await page.evaluate(()=>closes),1);
  await page.locator('#next-video').click();await page.waitForFunction(()=>document.querySelector('#page-label').textContent==='Video 2');await page.locator('#q').press('Control+Enter');
  await page.waitForFunction(()=>opened.length===2);assert.equal(await page.evaluate(()=>opened[1].active),false);assert.match(await page.evaluate(()=>opened[1].url),/v=bbbbbbbbbbb/);
  await page.locator('#q').fill('old slow');await page.waitForFunction(()=>!!window.releaseOld);
  await page.locator('#q').fill('new clue');await page.locator('#q').press('Enter');await page.waitForFunction(()=>opened.length===3);assert.match(await page.evaluate(()=>opened[2].url),/v=bbbbbbbbbbb/);
  await page.evaluate(()=>releaseOld());await page.waitForTimeout(300);assert.equal(await page.locator('.result .title').textContent(),'new clue');assert.equal(await page.evaluate(()=>opened.length),3);
  await page.locator('#single-video').uncheck();await page.locator('#q').press('Enter');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>opened.length),3);
  await page.locator('#q').press('ArrowDown');await page.locator('#q').press('Control+Enter');await page.waitForFunction(()=>opened.length===4);
  await page.locator('#q').fill('');await page.locator('#q').press('Enter');assert.equal(await page.evaluate(()=>opened.length),4);
  console.log('DEMO_FIXES_PASS: Enter opens shown/current fresh match, background modifier, stale-response rejection, list keyboard behavior, empty query, scene warmup on popup open. Controlled search/tabs.');
 }finally{await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
