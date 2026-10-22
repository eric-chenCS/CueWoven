const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const f=await fixture(),report={checks:[],errors:[]};f.context.on('weberror',event=>report.errors.push(event.error().message));
 try{
  await f.send({type:'status'});
  await f.options.evaluate(()=>chrome.storage.local.set({onboardingComplete:true,liteModeInitialized:true,settings:{enabled:false,lightMode:true,maxAgeDays:28,sceneStorageMB:240}}));
  await f.options.reload();await f.options.waitForFunction(()=>document.querySelector('#enabled').checked===false);
  const seed=async()=>{const response=await f.send({target:'offscreen',type:'import-history',videos:[{videoId:'confirm0001',title:'Preserve this battery charging video until confirmed',watchedAt:Date.now()}]});assert.equal(response.error,undefined);};
  await seed();
  await f.options.evaluate(()=>{
   const send=chrome.runtime.sendMessage.bind(chrome.runtime);window.requests=[];window.holdDefaults=true;
   chrome.runtime.sendMessage=async msg=>{window.requests.push(msg.type);if(msg.type==='settings-defaults'&&window.holdDefaults)await new Promise(resolve=>window.releaseDefaults=resolve);return send(msg);};
  });
  const dialog=f.options.locator('#confirm-dialog'),confirm=f.options.locator('#confirm-ok'),cancel=dialog.locator('button[value=cancel]');
  const requests=()=>f.options.evaluate(()=>window.requests),stored=()=>f.options.evaluate(()=>chrome.storage.local.get('settings').then(value=>value.settings));
  const waitClosed=()=>f.options.waitForFunction(()=>!document.querySelector('#confirm-dialog').open);
  const waitAction=label=>f.options.waitForFunction(label=>document.querySelector('#confirm-dialog').open&&document.querySelector('#confirm-ok').textContent===label,label);
  await f.options.locator('#maxAgeDays').selectOption('0');await f.options.locator('#clear').click();
  assert.equal(await confirm.innerText(),'Delete everything');
  await f.options.evaluate(()=>{window.holdDefaults=false;window.releaseDefaults();});
  await f.options.waitForFunction(()=>document.querySelector('#maxAgeDays').value==='28',null,{timeout:3000});
  assert.equal(await confirm.innerText(),'Delete everything','a late confirmation must not overwrite the active action');
  await cancel.click();await waitClosed();
  assert.equal((await f.send({type:'list'})).videos.length,1);assert.equal((await stored()).maxAgeDays,28);
  assert.ok(!(await requests()).some(type=>['clear','forget-recent','prune'].includes(type)));
  report.checks.push('delayed Forever request cannot replace or share approval with a pending deletion; Cancel preserves data');
  for(const key of ['Escape','Enter']){
   await f.options.locator('#clear').click();assert.equal(await cancel.evaluate(node=>node===document.activeElement),true);
   await f.options.keyboard.press(key);await waitClosed();assert.equal((await f.send({type:'list'})).videos.length,1);
  }
  await f.options.locator('#clear').click();assert.equal(await confirm.innerText(),'Delete everything');await confirm.click();
  await f.options.waitForFunction(()=>document.querySelector('#data-msg').textContent==='Everything was deleted.');assert.equal((await f.send({type:'list'})).videos.length,0);
  report.checks.push('Escape and default Enter cancel deletion; explicit Delete everything deletes only after approval');
  await seed();await f.options.locator('#forget-recent').click();assert.equal(await confirm.innerText(),'Forget items');await cancel.click();await waitClosed();
  assert.ok(!(await requests()).includes('forget-recent'));assert.equal((await f.send({type:'list'})).videos.length,1);
  await f.options.locator('#forget-recent').click();await confirm.click();await f.options.waitForFunction(()=>document.querySelector('#data-msg').textContent.startsWith('Forgot '));
  assert.equal((await f.send({type:'list'})).videos.length,0);report.checks.push('Forget items requires its own approval and remains usable after other dialogs');
  await f.options.locator('#sceneStorageMB').selectOption('120');await waitAction('Lower storage');await cancel.click();await waitClosed();
  await f.options.waitForFunction(()=>document.querySelector('#sceneStorageMB').value==='240');assert.equal((await stored()).sceneStorageMB,240);
  await f.options.locator('#sceneStorageMB').selectOption('120');await waitAction('Lower storage');await confirm.click();await f.options.waitForFunction(()=>chrome.storage.local.get('settings').then(({settings})=>settings.sceneStorageMB===120));
  report.checks.push('lower-storage cancellation preserves the budget; explicit approval saves it');
  await f.options.locator('#maxAgeDays').selectOption('0');await waitAction('Keep forever');await cancel.click();await waitClosed();
  await f.options.waitForFunction(()=>document.querySelector('#maxAgeDays').value==='28');
  await f.options.locator('#maxAgeDays').selectOption('0');await waitAction('Keep forever');await confirm.click();await f.options.waitForFunction(()=>chrome.storage.local.get('settings').then(({settings})=>settings.maxAgeDays===0));
  report.checks.push('Forever remains cancellable and can be approved later with its own dialog');
  const popup=await f.context.newPage();await popup.goto(f.base+'/popup/popup.html');
  const samples=await popup.evaluate(()=>chrome.runtime.sendMessage({type:'load-samples'}));assert.equal(samples.error,undefined);
  await popup.locator('#q').fill('a YouTube video about batteries');await popup.locator('#q').press('Enter');
  await popup.locator('#ignore-inferred').waitFor({state:'visible'});assert.equal(await popup.locator('#ignore-inferred').innerText(),'Remove filters');
  await popup.locator('#ignore-inferred').click();await popup.waitForFunction(()=>document.querySelector('#ignore-inferred').hidden);
  report.checks.push('Remove filters retains its new wording after real search and still broadens results');
  assert.deepEqual(report.errors,[]);report.pass=true;console.log('CONFIRMATION_ACTIONS_PASS',JSON.stringify(report));
 }catch(error){report.error=error.stack;throw error;}
 finally{if(process.env.RECALL_REPORT_DIR){fs.mkdirSync(process.env.RECALL_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR,'confirmation-actions.json'),JSON.stringify(report,null,2));}await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
