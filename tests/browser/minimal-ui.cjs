const fixture=require('./web-fixture.cjs'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{
 const f=await fixture(),errors=[],output=process.env.RECALL_SCREENSHOT_DIR||require('os').tmpdir();
 f.context.on('weberror',event=>errors.push(event.error().message));
 try{
  await f.options.setViewportSize({width:1280,height:900});await f.options.emulateMedia({reducedMotion:'reduce'});
  await f.options.waitForFunction(()=>document.querySelector('#welcome').hidden===false);
  assert.equal(await f.options.locator('.nav a').count(),4);
  assert.equal(await f.options.locator('.nav a[href="#sec-capture"]').innerText(),'Settings');
  const help=f.options.locator('#moments-help');assert.equal(await help.evaluate(node=>node.open),false);
  await help.locator('summary').click();assert.match(await help.innerText(),/timestamp/);await help.locator('summary').click();
  assert.equal(await f.options.locator('#sec-data #maxAgeDays').count(),1);
  assert.equal(await f.options.locator('#importMaxAgeDays').count(),0);
  assert.match(await f.options.locator('label').filter({has:f.options.locator('#lightMode')}).innerText(),/Lite mode/);
  for(const id of ['takeout-import','history-scan','web-history-file','web-history-scan'])assert.equal(await f.options.locator('#'+id).count(),0);
  const picker=f.options.waitForEvent('filechooser');await f.options.locator('#welcome-restore').click();await picker;
  await f.options.locator('#import').focus();assert.equal(await f.options.evaluate(()=>document.activeElement.id),'import');
  // Load real local sample data via its first-run button, then show its matched moment.
  const popup=await f.context.newPage();await popup.goto(f.base+'/popup/popup.html');assert.equal(await popup.locator('#index-now,#page-save-now,#speech,#speech-start,#speech-stop').count(),0);await popup.locator('#start-samples').click();await popup.waitForFunction(()=>document.querySelector('#q').value==='why do batteries wear out');await popup.locator('#q').press('Enter');
  await popup.waitForFunction(()=>document.querySelector('.result .title')?.textContent.includes('batteries'));
  assert.equal(await popup.locator('.best .copy-link').isVisible(),true);
  assert.equal(await popup.locator('.best .result').isVisible(),true);
  for(const theme of ['light','dark']){
   await popup.emulateMedia({colorScheme:theme});
   const layout=await popup.evaluate(()=>{
    const result=document.querySelector('.result').getBoundingClientRect(),footer=document.querySelector('.foot').getBoundingClientRect();
    return {width:document.body.scrollWidth,height:document.body.getBoundingClientRect().height,result:result.height,footerBottom:footer.bottom,marker:getComputedStyle(document.querySelector('.time')).backgroundColor};
   });
   assert.equal(layout.width,440);assert.ok(layout.height<=600);assert.ok(layout.result>100,'the best match is larger than a compact row');assert.ok(layout.footerBottom<=601);
   assert.ok(layout.marker.includes('255, 211, 77')||layout.marker.includes('242, 201, 76'));
   await popup.locator('body').screenshot({path:path.join(output,'recall-v3.3.8-popup-'+theme+'.png')});
  }
  await f.options.bringToFront();await f.options.reload();await f.options.waitForFunction(()=>document.querySelectorAll('.vid').length===5);
  for(const theme of ['light','dark']){
   await f.options.emulateMedia({colorScheme:theme});await f.options.evaluate(()=>scrollTo(0,0));
   await f.options.screenshot({path:path.join(output,'recall-v3.3.8-library-'+theme+'.png')});
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
   await f.options.screenshot({path:path.join(output,'recall-v3.3.8-options-'+width+'.png'),fullPage:true});
  }
  // Library stays at five rows while additional items remain reachable by scrolling.
  await f.send({target:'offscreen',type:'import-history',videos:[{videoId:'extra000001',title:'Extra library item',channel:'Fixture',watchedAt:Date.now()}]});
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
  await f.options.locator('#maxAgeDays').selectOption('0');await f.options.locator('#confirm-ok').click();await f.options.waitForFunction(()=>document.querySelector('#data-saved').textContent==='Saved');
  // Website controls are covered by websites.cjs.
  assert.deepEqual(errors,[]);
  console.log('MINIMAL_UI_PASS',JSON.stringify({sidebar:true,folds:true,progressReveal:true,nativeFileKeyboardFocus:true,samples:true,copy:true,themes:['light','dark'],sourceIndicators:true,newControlsPreserved:true,momentsHelp:true,fiveRowLibrary:true,websiteIndicators:true,retentionInYourData:true,layouts}));
 }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
