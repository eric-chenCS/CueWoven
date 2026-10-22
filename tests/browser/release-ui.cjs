const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict');
(async()=>{
 const f=await fixture();
 try{
  const manifest=await f.options.evaluate(()=>chrome.runtime.getManifest());
  assert.equal(await f.options.locator('#version').innerText(),'v'+(manifest.version_name||manifest.version));
  assert.match(await f.options.locator('label').filter({has:f.options.locator('#screenTextEnabled')}).innerText(),/slides and code/);
  const placeholder=await f.options.evaluate(async()=>{
   const image=new Image();image.src=chrome.runtime.getURL('icons/web.svg');await image.decode();
   const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return {cornerAlpha:ctx.getImageData(0,0,1,1).data[3],hasDrawing:ctx.getImageData(0,0,160,90).data.some((value,i)=>i%4===3&&value>0)};
  });assert.deepEqual(placeholder,{cornerAlpha:0,hasDrawing:true});
  const popup=await f.context.newPage();await popup.goto(f.base+'/popup/popup.html');
  for(const theme of ['dark','light']){
   await f.options.evaluate(theme=>chrome.storage.local.set({theme}),theme);
   await popup.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
   assert.equal(await popup.title(),'CueWoven');assert.equal(await popup.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  console.log('RELEASE_UI_PASS: manifest version, OCR explanation, transparent visible placeholder and popup themes');
 }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
