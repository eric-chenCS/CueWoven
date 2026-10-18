const fixture=require('./web-fixture.cjs'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{
 const f=await fixture(),errors=[],output=process.env.RECALL_SCREENSHOT_DIR||require('os').tmpdir();
 f.context.on('weberror',event=>errors.push(event.error().message));
 try{
  await f.options.setViewportSize({width:1280,height:900});await f.options.emulateMedia({reducedMotion:'reduce'});
  await f.options.waitForFunction(()=>document.querySelector('#welcome').hidden===false);
  assert.equal(await f.options.locator('.nav a').count(),5);
  assert.equal(await f.options.locator('.nav a[href="#sec-capture"]').innerText(),'Settings');
  const help=f.options.locator('#moments-help');assert.equal(await help.evaluate(node=>node.open),false);
  await help.locator('summary').click();assert.match(await help.innerText(),/timestamp/);await help.locator('summary').click();
  assert.equal(await f.options.locator('#sec-data #maxAgeDays').count(),1);
  assert.equal(await f.options.locator('#sec-data #importMaxAgeDays').count(),1);
  assert.match(await f.options.locator('label').filter({has:f.options.locator('#lightMode')}).innerText(),/Lite mode/);
  assert.equal(await f.options.locator('#takeout-import').evaluate(node=>node.closest('details').open),false);
  const picker=f.options.waitForEvent('filechooser');await f.options.locator('#welcome-import').click();await picker;
  assert.equal(await f.options.locator('#takeout-import').evaluate(node=>node.closest('details').open),true);
  const fold=f.options.locator('details').filter({has:f.options.locator('#takeout-import')});
  assert.equal(await fold.locator('#history-scan').count(),1,'both YouTube import methods share one section');
  assert.equal(await f.options.locator('#sec-add > .sheet > details').count(),3);
  assert.equal(await fold.locator('#history-scan').isVisible(),true);
  await fold.locator('summary').first().click();
  await f.options.locator('#history-import-msg').evaluate(node=>node.textContent='Adding 1 of 2…');
  await f.options.waitForFunction(()=>document.querySelector('#takeout-import').closest('details').open,null,{timeout:5000});
  // File selectors remain native keyboard-focusable controls in the new folds.
  await f.options.locator('#takeout-import').focus();assert.equal(await f.options.evaluate(()=>document.activeElement.id),'takeout-import');
  await f.options.locator('#startup-msg').evaluate(node=>node.textContent='');
  await f.options.locator('#history-import-msg').evaluate(node=>node.textContent='');
  await fold.locator('summary').first().click();
  // Load real local sample data via its first-run button, then show its matched moment.
  const popup=await f.context.newPage();await popup.goto(f.base+'/popup/popup.html');await popup.locator('#start-samples').click();
  await popup.waitForFunction(()=>document.querySelector('.result .title')?.textContent.includes('batteries'));
  assert.equal(await popup.locator('.copy-link').isVisible(),true);
  assert.equal(await popup.locator('#next-video').isVisible(),true);
  for(const theme of ['light','dark']){
   await popup.emulateMedia({colorScheme:theme});
   const layout=await popup.evaluate(()=>{
    const result=document.querySelector('.result').getBoundingClientRect(),footer=document.querySelector('.foot').getBoundingClientRect();
    return {width:document.body.scrollWidth,height:document.body.getBoundingClientRect().height,result:result.height,footerBottom:footer.bottom,marker:getComputedStyle(document.querySelector('.time')).backgroundColor};
   });
   assert.equal(layout.width,440);assert.ok(layout.height<=600);assert.ok(layout.result>170);assert.ok(layout.footerBottom<=601);
   assert.ok(layout.marker.includes('255, 211, 77')||layout.marker.includes('242, 201, 76'));
   await popup.locator('body').screenshot({path:path.join(output,'recall-v3.3.4-popup-'+theme+'.png')});
  }
  await f.options.bringToFront();await f.options.reload();await f.options.waitForFunction(()=>document.querySelectorAll('.vid').length===5);
  for(const theme of ['light','dark']){
   await f.options.emulateMedia({colorScheme:theme});await f.options.evaluate(()=>scrollTo(0,0));
   await f.options.screenshot({path:path.join(output,'recall-v3.3.4-library-'+theme+'.png')});
  }
  await f.options.locator('.nav a[href="#sec-websites"]').click();
  await f.options.waitForFunction(()=>document.querySelector('.nav a[href="#sec-websites"]').getAttribute('aria-current')==='true');
  assert.equal(await f.options.locator('#web-domain').isVisible(),true);
  const more=f.options.locator('details.fold').filter({has:f.options.locator('#web-searches')});
  assert.equal(await more.evaluate(node=>node.open),false);await more.locator('summary').first().click();
  assert.equal(await f.options.locator('#web-searches').isVisible(),true);
  assert.equal(await f.options.locator('#web-searches').isChecked(),false);
  await f.options.locator('#lightMode').check();assert.equal(await f.options.locator('#scenesEnabled').isDisabled(),true);
  const layouts=[];
  for(const width of [320,768,1024,1440]){
   await f.options.setViewportSize({width,height:900});
   const overflow=await f.options.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,'options overflow at '+width);layouts.push({width,overflow});
   assert.equal(await f.options.locator('#maxAgeDays').isVisible(),true);
   assert.equal(await f.options.locator('#forget-recent').isVisible(),true);
   await f.options.locator('.nav a[href="#sec-capture"]').click();
   const position=await f.options.evaluate(()=>({heading:document.querySelector('#capture-heading').getBoundingClientRect().top,menu:document.querySelector('.side').getBoundingClientRect().bottom}));
   if(width<=900)assert.ok(position.heading>=position.menu,'section heading must clear the sticky menu');
   await f.options.evaluate(()=>scrollTo(0,0));
   await f.options.screenshot({path:path.join(output,'recall-v3.3.4-options-'+width+'.png'),fullPage:true});
  }
  // Library stays at five rows while additional items remain reachable by scrolling.
  await f.send({type:'import-history',videos:[{videoId:'extra000001',title:'Extra library item',channel:'Fixture',watchedAt:Date.now()}]});
  await f.options.reload();await f.options.waitForFunction(()=>document.querySelectorAll('#library .vid').length===6);
  for(const width of [320,768,1024,1440]){
   await f.options.setViewportSize({width,height:900});
   await f.options.waitForFunction(()=>{const lib=document.querySelector('#library'),rows=lib.querySelectorAll('.vid');return Math.abs(lib.clientHeight-(rows[4].getBoundingClientRect().bottom-rows[0].getBoundingClientRect().top))<3;});
   assert.equal(await f.options.locator('#library').evaluate(node=>node.scrollHeight>node.clientHeight),true);
   await f.options.locator('#library').focus();await f.options.keyboard.press('End');
   await f.options.waitForFunction(()=>document.querySelector('#library').scrollTop>0);
   await f.options.locator('#library').evaluate(node=>node.scrollTop=0);
   assert.equal(await f.options.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await f.options.locator('#filter').fill('Extra library item');assert.equal(await f.options.locator('#library .vid').count(),1);
  assert.equal(await f.options.locator('#library').evaluate(node=>node.style.maxHeight),'');
  await f.options.locator('#filter').fill('');assert.equal(await f.options.locator('#library .vid').count(),6);
  await f.options.locator('#maxAgeDays').selectOption('0');await f.options.waitForFunction(()=>document.querySelector('#data-saved').textContent==='Saved');
  // Selected access, real browser permissions, pause/off and collapsed choices stay visible.
  await f.options.evaluate(()=>chrome.storage.local.set({webCapture:{enabled:true,paused:false,allSites:false,domains:['example.com','missing.test'],blocked:['blocked.test'],searches:false,audio:false},settings:{enabled:true,maxAgeDays:0,lightMode:false}}));
  await f.options.waitForFunction(()=>document.querySelector('#web-access').textContent.includes('Browser permission missing: missing.test'));
  assert.match(await f.options.locator('#web-access').innerText(),/example.com/);
  assert.match(await f.options.locator('#web-state').innerText(),/On.*selected sites/i);
  const choices=f.options.locator('details.fold').filter({has:f.options.locator('#web-pause')});
  assert.equal(await choices.evaluate(node=>node.open),false);await choices.locator('summary').first().click();
  await f.options.locator('#web-searches').check();await f.options.locator('#web-audio').check();
  await f.options.waitForFunction(()=>document.querySelector('#web-features').textContent==='Google search queries: On. Video audio: On.');
  await f.options.locator('#web-pause').click();await f.options.waitForFunction(()=>document.querySelector('#web-state').textContent.includes('Paused'));
  assert.equal(await f.options.locator('#web-pause').getAttribute('aria-pressed'),'true');
  assert.match(await f.options.locator('#web-access').innerText(),/example.com/);
  await choices.locator('summary').first().click();assert.match(await choices.locator('summary').first().innerText(),/Paused.*Queries on.*Audio on/);
  await f.options.evaluate(()=>chrome.storage.local.set({webCapture:{enabled:true,allSites:true,domains:[],blocked:[],searches:false,audio:false}}));
  await f.options.waitForFunction(()=>document.querySelector('#web-access').textContent.includes('Full browser permission is missing'));
  assert.equal(await f.options.locator('#web-all').getAttribute('aria-pressed'),'true');
  await choices.locator('summary').first().click();await f.options.locator('#web-off').click();
  await f.options.waitForFunction(()=>document.querySelector('#web-state').textContent.startsWith('Website capture: Off.'));
  assert.equal(await f.options.locator('#web-off').getAttribute('aria-pressed'),'true');
  await f.options.setViewportSize({width:1280,height:900});await f.options.locator('.nav a[href="#sec-websites"]').click();
  await f.options.screenshot({path:path.join(output,'recall-v3.3.4-websites.png')});
  assert.deepEqual(errors,[]);
  console.log('MINIMAL_UI_PASS',JSON.stringify({sidebar:true,folds:true,progressReveal:true,nativeFileKeyboardFocus:true,samples:true,copy:true,themes:['light','dark'],sourceIndicators:true,newControlsPreserved:true,momentsHelp:true,fiveRowLibrary:true,websiteIndicators:true,retentionInYourData:true,layouts}));
 }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
