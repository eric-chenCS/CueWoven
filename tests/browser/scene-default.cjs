const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const report={checks:[],errors:[]};
(async()=>{
 const f=await fixture();f.context.on('weberror',event=>report.errors.push(event.error().message));
 try{
  const defaults=await f.send({type:'settings-defaults'});assert.equal(defaults.scenesEnabled,false);assert.equal(defaults.articleImagesEnabled,false);
  await f.options.reload();await f.options.waitForFunction(()=>document.querySelector('#maxAgeDays').value==='28');
  assert.equal(await f.options.locator('#scenesEnabled').isChecked(),false);
  assert.equal(await f.options.locator('#articleImagesEnabled').count(),0);
  const label=f.options.locator('label').filter({has:f.options.locator('#scenesEnabled')});
  assert.match(await label.innerText(),/substantial RAM and CPU/);assert.match(await label.innerText(),/Default: Off/);assert.equal((await label.innerText()).match(/Default:/g).length,1);
  assert.match(await label.innerText(),/Previously saved visuals stay searchable/);
  report.checks.push('fresh scene capture defaults off with visible resource warning');
  // This test laptop is not in automatic Lite mode, so opt-in remains available.
  await f.options.locator('#scenesEnabled').check();
  await f.wait(()=>f.options.evaluate(()=>chrome.storage.local.get('settings').then(({settings})=>settings.scenesEnabled===true&&settings.articleImagesEnabled===true)));
  await f.wait(async()=>!(await f.send({type:'vision-status'})).busy);
  const scene=await f.options.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,320,180);ctx.fillStyle='red';ctx.fillRect(90,20,140,140);
   return chrome.runtime.sendMessage({target:'offscreen',type:'scene-index',video:{videoId:'sceneOff001',title:'Saved visual example',watchedAt:Date.now()},start:42,image:canvas.toDataURL('image/jpeg',.8)});
  });assert.equal(scene.error,undefined);assert.equal(scene.ok,true,JSON.stringify(scene));
  await f.options.reload();await f.options.waitForFunction(()=>document.querySelector('#scenesEnabled').checked);
  assert.match(await label.innerText(),/substantial RAM and CPU/);
  const before=await f.send({type:'export'});assert.equal(before.scenes.length,1);
  await f.options.locator('#scenesEnabled').uncheck();
  await f.wait(()=>f.options.evaluate(()=>chrome.storage.local.get('settings').then(({settings})=>settings.scenesEnabled===false&&settings.articleImagesEnabled===false)));
  assert.equal((await f.send({type:'export'})).scenes.length,1);
  const found=await f.send({type:'search',query:'a red square on a white background',videoId:'sceneOff001',distinct:true,inferFilters:false});
  assert.equal(found.results[0].videoId,'sceneOff001');assert.equal(found.results[0].start,42);
  report.checks.push('explicit opt-in survives reload; turning it off preserves searchable saved scenes');
  await f.options.locator('#scenesEnabled').check();
  await f.wait(()=>f.options.evaluate(()=>chrome.storage.local.get('settings').then(({settings})=>settings.scenesEnabled===true&&settings.articleImagesEnabled===true)));
  await f.options.locator('#reset-settings').click();await f.options.waitForFunction(()=>document.querySelector('#reset-msg').textContent.startsWith('Settings reset'));
  assert.equal(await f.options.locator('#scenesEnabled').isChecked(),false);
  assert.equal((await f.send({type:'export'})).scenes.length,1);
  for(const scenes of [false,true]) {
   await f.options.evaluate(async scenes=>{const {settings}=await chrome.storage.local.get('settings');await chrome.storage.local.set({settings:{...settings,scenesEnabled:scenes,articleImagesEnabled:!scenes}});},scenes);
   await f.options.reload();await f.options.waitForFunction(()=>document.querySelector('#scenesEnabled').indeterminate);
   assert.equal(await f.options.locator('#visual-mixed').isVisible(),true);
   await f.options.locator('#dwellSeconds').selectOption('20');
   await f.wait(()=>f.options.evaluate(()=>chrome.storage.local.get('settings').then(({settings})=>settings.dwellSeconds===20)));
   const saved=await f.options.evaluate(()=>chrome.storage.local.get('settings'));
   assert.equal(saved.settings.scenesEnabled,scenes);assert.equal(saved.settings.articleImagesEnabled,!scenes);
   await f.options.locator('#scenesEnabled').click();
   await f.wait(()=>f.options.evaluate(()=>chrome.storage.local.get('settings').then(({settings})=>settings.scenesEnabled===settings.articleImagesEnabled)));
   assert.equal(await f.options.locator('#visual-mixed').isVisible(),false);
   assert.equal(await f.options.locator('#visual-mixed').textContent(),'');
  }
  await f.options.locator('#reset-settings').click();await f.options.waitForFunction(()=>document.querySelector('#reset-msg').textContent.startsWith('Settings reset'));
  report.checks.push('combined toggle controls both features and preserves legacy mixed choices on unrelated saves');
  if(process.env.RECALL_SCREENSHOT_DIR)await f.options.locator('#sec-capture').screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR,'scene-default-warning.png')});
  report.checks.push('reset restores off without deleting saved scenes');
  assert.deepEqual(report.errors,[]);report.pass=true;console.log('SCENE_DEFAULT_PASS',JSON.stringify(report));
 }finally{if(process.env.RECALL_REPORT_DIR)fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR,'scene-default.json'),JSON.stringify(report,null,2));await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
