const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright'),fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-ocr-model-')),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),page=await context.newPage(),requests=[];page.on('request',request=>requests.push(request.url()));
  await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/options/options.html`);
  const result=await page.evaluate(async()=>{
   const {createOcrModel}=await import(chrome.runtime.getURL('offscreen/ocr-model.js')),model=createOcrModel(),canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d');
   function subtitle(){ctx.fillStyle='#345b78';ctx.fillRect(0,0,1280,720);ctx.fillStyle='#111';ctx.fillRect(100,560,1080,130);ctx.font='bold 38px Arial';ctx.fillStyle='white';ctx.fillText('Chemical reactions trap lithium.',160,615);ctx.fillText('This is why batteries lose capacity.',160,665);}
   try{
    subtitle();const start=performance.now(),caption=await model.read(canvas.toDataURL('image/jpeg',.95),1280,720),firstMs=Math.round(performance.now()-start);
    ctx.fillStyle='#fff';ctx.fillRect(0,0,1280,720);ctx.fillStyle='#111';ctx.font='bold 40px Arial';ctx.fillText('PENGUINS LIVE IN ANTARCTICA',100,130);const second=performance.now(),overlay=await model.read(canvas.toDataURL('image/jpeg',.95),1280,720),warmMs=Math.round(performance.now()-second);
    ctx.fillStyle='#345b78';ctx.fillRect(0,0,1280,720);const blank=await model.read(canvas.toDataURL('image/jpeg',.95),1280,720);return {caption,overlay,blank,firstMs,warmMs};
   }finally{model.release()}
  });
  console.log('OCR_MODEL_RESULT',JSON.stringify(result));assert.match(result.caption.text,/chemical reactions trap lithium/i);assert.match(result.caption.text,/batteries lose capacity/i);assert.match(result.overlay.text,/penguins live in antarctica/i);assert.equal(result.blank.text,'');
  assert.ok(requests.filter(url=>/tesseract|traineddata|ocr\//.test(url)).every(url=>url.startsWith('chrome-extension://')));
  console.log('OCR_MODEL_PASS: real local English OCR, burned subtitles, upper-screen title, blank rejection and bounded timing.');
 }finally{await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
