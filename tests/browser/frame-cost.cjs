const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright'),fs=require('fs'),path=require('path'),os=require('os');const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..');
(async()=>{const browser=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-frame-cost-')),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});try{
 const worker=browser.serviceWorkers()[0]||await browser.waitForEvent('serviceworker'),page=await browser.newPage();await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/options/options.html`);
 const report=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#345b78';ctx.fillRect(0,0,1280,720);ctx.fillStyle='white';ctx.font='bold 38px Arial';ctx.fillText('The dose is 11 mg.',100,600);
  const measure=async operation=>{const samples=[];for(let i=0;i<20;i++){const start=performance.now();await operation();samples.push(performance.now()-start);}return Number(samples.sort((a,b)=>a-b)[10].toFixed(2));};
  const oldEncodeAndHashMs=await measure(async()=>{const jpeg=canvas.toDataURL('image/jpeg',.95);await crypto.subtle.digest('SHA-256',new TextEncoder().encode(jpeg));});
  const unchangedPixelsMs=await measure(async()=>{await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,1280,720).data);});
  const changedPixelsAndEncodeMs=await measure(async()=>{await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,1280,720).data);canvas.toDataURL('image/jpeg',.95);});
  return {oldEncodeAndHashMs,unchangedPixelsMs,changedPixelsAndEncodeMs,width:1280,height:720,temporaryPixelBytes:1280*720*4,scope:'20-iteration static-canvas median; excludes video decode, OCR and model inference. One isolated machine.'};
 });console.log('FRAME_COST',JSON.stringify(report));if(process.env.RECALL_SCREENSHOT_DIR)fs.writeFileSync(path.join(process.env.RECALL_SCREENSHOT_DIR,'recall-v2.14-frame-cost.json'),JSON.stringify(report,null,2)+'\n');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
