const fixture=require('./web-fixture.cjs'),assert=require('assert/strict'),path=require('path'),os=require('os');
(async()=>{const f=await fixture(),errors=[];f.context.on('weberror',e=>errors.push(e.error().message));try{
 await f.options.waitForFunction(()=>document.querySelector('#maxAgeDays').value==='28');
 const expected=['24 hours','7 days','4 weeks','12 months','Forever'];
 const labels=async selector=>(await f.options.locator(selector).allTextContents()).map(text=>text.replace(' (default option)',''));
 for(const id of ['maxAgeDays'])assert.deepEqual(await labels('#'+id+' option'),expected);
 assert.equal(await f.options.locator('#sec-capture #theme').count(),1);
 const defaults={theme:'system',dwellSeconds:'10',maxAgeDays:'28',sceneStorageMB:'240'};
 for(const [id,value] of Object.entries(defaults)){const option=f.options.locator('#'+id+' option[data-default]');assert.equal(await option.count(),1);assert.equal(await option.getAttribute('value'),value);assert.match(await option.textContent(),/\(default option\)/);}
 const popup=await f.context.newPage();await popup.goto(f.base+'/popup/popup.html');
 for(const theme of ['light','dark']){
  const opposite=theme==='dark'?'light':'dark';await f.options.emulateMedia({colorScheme:opposite});await popup.emulateMedia({colorScheme:opposite});
  await f.options.locator('#theme').selectOption(theme);
  for(const page of [f.options,popup]){
   await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
   assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),theme);
   assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),theme==='dark'?'rgb(61, 61, 61)':'rgb(237, 237, 237)');
  }
  await f.options.reload();await f.options.waitForFunction(theme=>document.querySelector('#theme').value===theme,theme);
  await f.options.screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR||os.tmpdir(),'recall-v3.3.4-theme-'+theme+'.png')});
 }
 await f.options.locator('#theme').selectOption('system');await f.options.waitForFunction(()=>!document.documentElement.dataset.theme);
 for(const value of ['1','7','28','365','0']){
  await f.options.locator('#maxAgeDays').selectOption(value);
  await f.options.waitForFunction(value=>chrome.storage.local.get('settings').then(s=>s.settings.maxAgeDays===Number(value)),value);
 }
 // Old ranges remain intact until explicitly changed, including when another setting is saved.
 await f.options.evaluate(()=>chrome.storage.local.set({settings:{maxAgeDays:30,importMaxAgeDays:90,enabled:true}}));await f.options.reload();
 await f.options.waitForFunction(()=>document.querySelector('#maxAgeDays').value==='30');assert.equal(await f.options.locator('#importMaxAgeDays').count(),0);
 await f.options.locator('#lightMode').check();await f.options.waitForFunction(()=>chrome.storage.local.get('settings').then(s=>s.settings.lightMode));
 const retained=await f.options.evaluate(()=>chrome.storage.local.get('settings'));assert.equal(retained.settings.maxAgeDays,30);assert.equal(retained.settings.importMaxAgeDays,90);
 // Reset preferences leaves saved records, retention, site choices and browser grants intact.
 const imported=await f.send({target:'offscreen',type:'import-history',videos:[{videoId:'resetKeep01',title:'Keep my saved video',channel:'Fixture',watchedAt:Date.now()}]});assert.equal(imported.error,undefined);
 const libraryBefore=await f.send({type:'list'});
 await f.options.evaluate(()=>chrome.storage.local.set({settings:{enabled:false,lightMode:true,speechEnabled:false,scenesEnabled:false,screenTextEnabled:false,dwellSeconds:60,perVideo:5,maxAgeDays:0,importMaxAgeDays:90},theme:'dark',singleVideoView:false,webCapture:{enabled:false,paused:true,domains:['example.com'],blocked:['excluded.test'],audio:true,searches:true},otherData:'keep'}));
 await f.options.reload();await f.options.waitForFunction(()=>document.querySelector('#theme').value==='dark');
 const sitesBefore=await f.options.evaluate(()=>chrome.storage.local.get('webCapture')),permissionsBefore=await f.options.evaluate(()=>chrome.permissions.getAll());
 assert.equal(await f.options.locator('#reset-settings').innerText(),'Reset settings to default');
 await f.options.locator('#reset-settings').click();await f.options.waitForFunction(()=>document.querySelector('#reset-msg').textContent.startsWith('Settings reset'));
 const reset=await f.options.evaluate(()=>chrome.storage.local.get(['settings','theme','singleVideoView','otherData']));
 for(const [key,value] of Object.entries({enabled:true,lightMode:false,speechEnabled:true,scenesEnabled:true,screenTextEnabled:true,dwellSeconds:10,perVideo:2,maxAgeDays:0,importMaxAgeDays:90}))assert.equal(reset.settings[key],value,key);
 assert.equal(reset.theme,'system');assert.equal(reset.otherData,'keep');
 assert.deepEqual(await f.send({type:'list'}),libraryBefore);
 assert.deepEqual(await f.options.evaluate(()=>chrome.storage.local.get('webCapture')),sitesBefore);
 assert.deepEqual(await f.options.evaluate(()=>chrome.permissions.getAll()),permissionsBefore);
 for(const key of ['speechEnabled','scenesEnabled','screenTextEnabled'])assert.equal(await f.options.locator('#'+key).isDisabled(),false);
 await f.options.reload();await f.options.waitForFunction(()=>document.querySelector('#lightMode').checked===false&&document.querySelector('#dwellSeconds').value==='10');
 assert.equal(await f.options.locator('#theme').inputValue(),'system');assert.equal(await f.options.locator('#dwellSeconds').inputValue(),'10');
 await f.options.locator('#sec-capture').screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR||os.tmpdir(),'recall-v3.3.6-settings.png')});
 await f.options.evaluate(()=>{window.realSave=chrome.storage.local.set.bind(chrome.storage.local);chrome.storage.local.set=async()=>{throw Error('Controlled storage failure');};});
 await f.options.locator('#reset-settings').click();await f.options.waitForFunction(()=>document.querySelector('#reset-msg').textContent.includes('Could not reset settings: Controlled storage failure'));
 assert.equal(await f.options.locator('#reset-settings').isEnabled(),true);
 await f.options.evaluate(()=>chrome.storage.local.set=window.realSave);
 assert.deepEqual(errors,[]);console.log('PREFERENCES_PASS: retention choices/save, preserved legacy ranges, explicit light/dark across popup/options/reload and system fallback, default labels and reset without changing library, retention or site permissions.');
}finally{await f.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
