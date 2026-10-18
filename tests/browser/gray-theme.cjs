const fixture=require('./web-fixture.cjs'),assert=require('assert/strict'),path=require('path'),os=require('os');
(async()=>{const f=await fixture(),output=process.env.RECALL_SCREENSHOT_DIR||os.tmpdir();try{
 await f.options.evaluate(async()=>{const {DEFAULT_DOMAINS}=await import('../lib/web-sites.js');await chrome.storage.local.set({onboardingComplete:true,webCapture:{enabled:false,paused:true,domains:[...DEFAULT_DOMAINS,'example.com'],blocked:[]}});});
 const popup=await f.context.newPage();await popup.setViewportSize({width:440,height:600});await popup.goto(f.base+'/popup/popup.html');
 await f.options.setViewportSize({width:1280,height:900});await f.options.emulateMedia({reducedMotion:'reduce'});
 await f.options.locator('.nav a[href="#sec-capture"]').click();
 const rgb=hex=>'rgb('+hex.match(/../g).map(v=>parseInt(v,16)).join(', ')+')';
 for(const [theme,paper,surface,focus,border,danger] of [['dark','3d3d3d','333333','ffffff','a0a0a0','ff8a80'],['light','ededed','ffffff','000000','848484','b42318']]){
  await f.options.locator('#theme').selectOption(theme);
  await popup.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
  await popup.locator('#q').focus();
  const colors=await popup.evaluate(()=>{const q=getComputedStyle(document.querySelector('#q')),button=getComputedStyle(document.querySelector('#refine-toggle'));return{paper:getComputedStyle(document.body).backgroundColor,surface:q.backgroundColor,focus:q.borderTopColor,ring:q.boxShadow,border:button.borderTopColor}});
  assert.equal(colors.paper,rgb(paper));assert.equal(colors.surface,rgb(surface));assert.equal(colors.focus,rgb(focus));assert.ok(colors.ring.includes(rgb(focus)));assert.equal(colors.border,rgb(border));
  assert.equal(await f.options.locator('.sheet').first().evaluate(el=>getComputedStyle(el).backgroundColor),rgb(surface));
  assert.equal(await f.options.locator('#clear').evaluate(el=>getComputedStyle(el).borderTopColor),rgb(danger));
  const contrast=await f.options.evaluate(()=>{
   const style=getComputedStyle(document.documentElement),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.width=canvas.height=1;
   const color=value=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3)};
   const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
   const ratio=(a,b)=>{const x=luminance(color(a)),y=luminance(color(b));return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
   const token=name=>style.getPropertyValue('--'+name).trim(),pairs=[];
   for(const fg of ['ink','ink-2','ink-3','action'])for(const bg of ['paper','surface','sunken'])pairs.push({name:fg+'/'+bg,ratio:ratio(token(fg),token(bg)),minimum:4.5});
   for(const [fg,bg] of [['action-ink','action'],['bad','bad-soft'],['ink-2','action-soft']])pairs.push({name:fg+'/'+bg,ratio:ratio(token(fg),token(bg)),minimum:4.5});
   for(const fg of ['focus','line-strong'])pairs.push({name:fg+'/surface',ratio:ratio(token(fg),token('surface')),minimum:3});
   for(const chip of document.querySelectorAll('#web-sites .site')){const s=getComputedStyle(chip);pairs.push({name:'site-chip',ratio:ratio(s.color,s.backgroundColor),minimum:4.5});}
   return pairs;
  });
  assert.deepEqual(contrast.filter(p=>p.ratio<p.minimum),[],theme+' contrast failures');
  console.log(theme+' contrast',JSON.stringify({lowestText:Math.min(...contrast.filter(p=>p.minimum===4.5).map(p=>p.ratio)),controlBorder:contrast.find(p=>p.name==='line-strong/surface').ratio}));
  await popup.locator('body').screenshot({path:path.join(output,'recall-gray-color-popup-'+theme+'.png')});
  await f.options.evaluate(()=>scrollTo({top:document.querySelector('#sec-capture').offsetTop-32,behavior:'instant'}));
  await f.options.screenshot({path:path.join(output,'recall-gray-color-settings-'+theme+'.png')});
  await f.options.locator('.nav a[href="#sec-websites"]').click();
  assert.equal(await f.options.locator('#web-sites .site-group[data-group]').count(),4);
  await f.options.evaluate(()=>scrollTo({top:document.querySelector('#sec-websites').offsetTop-32,behavior:'instant'}));
  if(theme==='dark'){
   const icon=f.options.locator('#web-sites .site img').first();await icon.evaluate(el=>{el.loading='eager';el.src='data:image/png;base64,broken'});
   await f.options.waitForFunction(()=>{const img=document.querySelector('#web-sites .site img');return img.complete&&img.naturalWidth>0});
   await icon.evaluate(async el=>{const {setItemImage}=await import('../lib/item-image.js');setItemImage(el,{kind:'page',url:'https://nytimes.com'});await el.decode();});
  }
  await f.options.screenshot({path:path.join(output,'recall-gray-color-websites-'+theme+'.png')});
  await f.options.locator('.nav a[href="#sec-capture"]').click();
  for(const width of [320,768,1024,1440]){await f.options.setViewportSize({width,height:900});assert.equal(await f.options.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await f.options.setViewportSize({width:1280,height:900});
 }
 await f.options.locator('#theme').selectOption('system');
 for(const theme of ['dark','light']){await popup.emulateMedia({colorScheme:theme});assert.equal(await popup.evaluate(()=>getComputedStyle(document.body).backgroundColor),theme==='dark'?rgb('3d3d3d'):rgb('ededed'));}
 console.log('GRAY_COLOR_THEME_PASS: explicit/system themes, white/black focus, quiet borders, preserved red, responsive settings');
}finally{await f.close()}})().catch(error=>{console.error(error);process.exitCode=1});
