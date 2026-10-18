const fixture=require('./web-fixture.cjs'),assert=require('assert/strict'),path=require('path'),os=require('os');
(async()=>{const f=await fixture(),errors=[];f.context.on('weberror',e=>errors.push(e.error().message));try{
 await f.options.waitForFunction(()=>document.querySelector('#maxAgeDays').value==='28');
 const expected=['24 hours','7 days','4 weeks','12 months','Forever'];
 for(const id of ['maxAgeDays','importMaxAgeDays'])assert.deepEqual(await f.options.locator('#'+id+' option').allTextContents(),expected);
 assert.deepEqual(await f.options.locator('#transcriptConcurrency option').allTextContents(),['1','3','6','10']);
 assert.equal(await f.options.locator('#sec-capture #theme').count(),1);
 const popup=await f.context.newPage();await popup.goto(f.base+'/popup/popup.html');
 for(const theme of ['light','dark']){
  const opposite=theme==='dark'?'light':'dark';await f.options.emulateMedia({colorScheme:opposite});await popup.emulateMedia({colorScheme:opposite});
  await f.options.locator('#theme').selectOption(theme);
  for(const page of [f.options,popup]){
   await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
   assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),theme);
   assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),theme==='dark'?'rgb(15, 20, 27)':'rgb(246, 247, 249)');
  }
  await f.options.reload();await f.options.waitForFunction(theme=>document.querySelector('#theme').value===theme,theme);
  await f.options.screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR||os.tmpdir(),'recall-v3.3.4-theme-'+theme+'.png')});
 }
 await f.options.locator('#theme').selectOption('system');await f.options.waitForFunction(()=>!document.documentElement.dataset.theme);
 const advanced=f.options.locator('details.fold').filter({has:f.options.locator('#transcriptConcurrency')});await advanced.locator('summary').first().click();
 for(const value of ['1','3','6','10']){await f.options.locator('#transcriptConcurrency').selectOption(value);await f.options.waitForFunction(value=>chrome.storage.local.get('settings').then(s=>s.settings.transcriptConcurrency===Number(value)),value);}
 for(const value of ['1','7','28','365','0']){
  await f.options.locator('#maxAgeDays').selectOption(value);await f.options.locator('#importMaxAgeDays').selectOption(value);
  await f.options.waitForFunction(value=>chrome.storage.local.get('settings').then(s=>s.settings.maxAgeDays===Number(value)&&s.settings.importMaxAgeDays===Number(value)),value);
 }
 // Old ranges remain intact until explicitly changed, including when another setting is saved.
 await f.options.evaluate(()=>chrome.storage.local.set({settings:{maxAgeDays:30,importMaxAgeDays:90,enabled:true,transcriptConcurrency:10}}));await f.options.reload();
 await f.options.waitForFunction(()=>document.querySelector('#maxAgeDays').value==='30');assert.equal(await f.options.locator('#importMaxAgeDays').inputValue(),'90');
 await f.options.locator('#lightMode').check();await f.options.waitForFunction(()=>chrome.storage.local.get('settings').then(s=>s.settings.lightMode));
 const retained=await f.options.evaluate(()=>chrome.storage.local.get('settings'));assert.equal(retained.settings.maxAgeDays,30);assert.equal(retained.settings.importMaxAgeDays,90);
 assert.deepEqual(errors,[]);console.log('PREFERENCES_PASS: retention choices/save, preserved legacy ranges, 1/3/6/10 persisted, explicit light/dark across popup/options/reload and system fallback.');
}finally{await f.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
