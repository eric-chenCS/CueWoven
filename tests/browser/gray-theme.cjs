const fixture=require('./web-fixture.cjs'),assert=require('assert/strict'),path=require('path'),os=require('os');
(async()=>{const f=await fixture(),output=process.env.RECALL_SCREENSHOT_DIR||os.tmpdir();try{
 await f.options.evaluate(()=>chrome.storage.local.set({onboardingComplete:true}));
 const popup=await f.context.newPage();await popup.setViewportSize({width:440,height:600});await popup.goto(f.base+'/popup/popup.html');
 await f.options.setViewportSize({width:1280,height:900});
 await f.options.locator('.nav a[href="#sec-capture"]').click();
 const rgb=hex=>'rgb('+hex.match(/../g).map(v=>parseInt(v,16)).join(', ')+')';
 for(const [theme,paper,surface,focus,border,danger] of [['dark','3d3d3d','333333','ffffff','c4c4c4','ff8a80'],['light','e2e2e2','fafafa','000000','737373','b42318']]){
  await f.options.locator('#theme').selectOption(theme);
  await popup.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
  await popup.locator('#q').focus();
  const colors=await popup.evaluate(()=>{const q=getComputedStyle(document.querySelector('#q')),button=getComputedStyle(document.querySelector('#refine-toggle'));return{paper:getComputedStyle(document.body).backgroundColor,surface:q.backgroundColor,focus:q.borderTopColor,ring:q.boxShadow,border:button.borderTopColor}});
  assert.equal(colors.paper,rgb(paper));assert.equal(colors.surface,rgb(surface));assert.equal(colors.focus,rgb(focus));assert.ok(colors.ring.includes(rgb(focus)));assert.equal(colors.border,rgb(border));
  assert.equal(await f.options.locator('.sheet').first().evaluate(el=>getComputedStyle(el).backgroundColor),rgb(surface));
  assert.equal(await f.options.locator('#clear').evaluate(el=>getComputedStyle(el).borderTopColor),rgb(danger));
  await popup.locator('body').screenshot({path:path.join(output,'recall-gray-popup-'+theme+'.png')});
  await f.options.screenshot({path:path.join(output,'recall-gray-settings-'+theme+'.png')});
  for(const width of [320,768,1024,1440]){await f.options.setViewportSize({width,height:900});assert.equal(await f.options.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await f.options.setViewportSize({width:1280,height:900});
 }
 await f.options.locator('#theme').selectOption('system');
 for(const theme of ['dark','light']){await popup.emulateMedia({colorScheme:theme});assert.equal(await popup.evaluate(()=>getComputedStyle(document.body).backgroundColor),theme==='dark'?rgb('3d3d3d'):rgb('e2e2e2'));}
 console.log('GRAY_THEME_PASS: explicit/system themes, white/black focus, neutral borders, preserved red, responsive settings');
}finally{await f.close()}})().catch(error=>{console.error(error);process.exitCode=1});
