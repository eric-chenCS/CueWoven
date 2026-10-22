const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict');
(async()=>{const f=await fixture();const errors=[];f.context.on('weberror',e=>errors.push(e.error().message));
 try{
  const wait=async predicate=>{const deadline=Date.now()+30000;while(Date.now()<deadline){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,200));}throw Error('Visual capture integration timed out');};
  await f.send({type:'settings-defaults'});
  await wait(()=>f.options.evaluate(()=>chrome.storage.local.get('webCapture').then(({webCapture})=>webCapture?.siteDefaultsVersion===2)));
  await f.enable();
  await f.options.evaluate(async()=>{const {webCapture}=await chrome.storage.local.get('webCapture');await chrome.storage.local.set({webCapture:{...webCapture,siteDefaultsVersion:2}});});
  await f.options.reload();await f.options.waitForFunction(()=>document.querySelector('#maxAgeDays').value==='0');
  await f.send({type:'web-sync'});
  const png=await f.options.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=180;const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,320,180);g.fillStyle='red';g.fillRect(90,20,140,140);return c.toDataURL('image/png').split(',')[1];});
  await f.context.route('https://visual.example.com/**',route=>route.request().url().endsWith('.png')?route.fulfill({contentType:'image/png',body:Buffer.from(png,'base64')}):route.fulfill({contentType:'text/html',body:`<!doctype html><title>Visual setting example</title><main><h1>Field observations</h1><p>${'A research team records observations from public field studies. '.repeat(25)}</p><figure><img src="/square.png" width="320" height="180" alt="A colored diagram"></figure></main>`}));
  const page=await f.context.newPage();const video=async suffix=>(await f.send({type:'list'})).videos.find(v=>v.url?.endsWith(suffix));
  await page.goto('https://visual.example.com/off');await wait(async()=>!!(await video('/off')));await page.waitForTimeout(4000);
  assert.equal((await video('/off')).sceneCount||0,0,'Off must retain page text without capturing its image');
  await f.options.locator('#scenesEnabled').check();await wait(()=>f.options.evaluate(()=>chrome.storage.local.get('settings').then(({settings:s})=>s.scenesEnabled&&s.articleImagesEnabled)));
  await page.bringToFront();await page.goto('https://visual.example.com/on');await wait(async()=>(await video('/on'))?.sceneCount===1);
  await f.options.locator('#scenesEnabled').uncheck();await wait(()=>f.options.evaluate(()=>chrome.storage.local.get('settings').then(({settings:s})=>!s.scenesEnabled&&!s.articleImagesEnabled)));
  await page.bringToFront();await page.goto('https://visual.example.com/off-again');await wait(async()=>!!(await video('/off-again')));await page.waitForTimeout(4000);
  assert.equal((await video('/off-again')).sceneCount||0,0);assert.equal((await video('/on')).sceneCount,1,'saved article images must survive disabling capture');
  assert.deepEqual(errors,[]);console.log('VISUAL_SETTING_ARTICLE_CAPTURE_PASS');
 }finally{await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
