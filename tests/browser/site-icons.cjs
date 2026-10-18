const fixture=require('./web-fixture.cjs'),assert=require('assert/strict'),path=require('path'),os=require('os');
(async()=>{const f=await fixture();try{
 const remote=[];f.context.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url())});
 await f.context.route(/^https?:\/\//,route=>route.abort());
 await f.options.evaluate(async()=>{const {DEFAULT_DOMAINS}=await import('../lib/web-sites.js');await chrome.storage.local.set({onboardingComplete:true,webCapture:{enabled:false,paused:true,domains:[...DEFAULT_DOMAINS,'example.com'],blocked:[]}})});
 await f.options.emulateMedia({reducedMotion:'reduce'});await f.options.setViewportSize({width:1280,height:1000});
 await f.options.locator('.nav a[href="#sec-websites"]').click();
 await f.options.locator('#web-sites img').evaluateAll(imgs=>imgs.forEach(img=>img.loading='eager'));
 await f.options.waitForFunction(()=>{const imgs=[...document.querySelectorAll('#web-sites img[src*="/icons/sites/"]')];return imgs.length===31&&imgs.every(img=>img.complete&&img.naturalWidth>=16)});
 const blank=await f.options.evaluate(()=>[...document.querySelectorAll('#web-sites img[src*="/icons/sites/"]')].filter(img=>{
  const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,32,32);const pixels=ctx.getImageData(0,0,32,32).data;
  for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>30&&Math.min(pixels[i],pixels[i+1],pixels[i+2])<230)return false;
  return true;
 }).map(img=>img.src));assert.deepEqual(blank,[],'A loaded favicon must contain visible artwork');
 for(const theme of ['dark','light']){
  await f.options.locator('#theme').selectOption(theme);
  await f.options.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
  await f.options.evaluate(()=>scrollTo({top:document.querySelector('#sec-websites').offsetTop-24,behavior:'instant'}));
  await f.options.screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR||os.tmpdir(),'recall-site-icons-'+theme+'.png')});
 }
 const fallback=await f.options.evaluate(async()=>{
  const {setItemImage}=await import('../lib/item-image.js'),img=document.querySelector('#web-sites img');
  setItemImage(img,{kind:'page',url:'https://www.youtube.com/'});
  img.onerror();const browser=img.src;img.onerror();const local=img.src;
  await img.decode();return{browser,local,loaded:img.naturalWidth>0};
 });assert.match(fallback.browser,/_favicon\//);assert.ok(fallback.local.endsWith('/icons/site.svg'));assert.ok(fallback.loaded);
 assert.deepEqual(remote,[],'Rendering site icons must not contact external sites or favicon services');
 console.log('SITE_ICONS_PASS: all 31 brands load offline, dark/light, custom browser-cache path, square globe fallback, zero remote requests');
}finally{await f.close()}})().catch(error=>{console.error(error);process.exitCode=1});
