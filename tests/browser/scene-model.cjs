const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=process.env.RECALL_EXTENSION || path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-scene-model-')),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 try {
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const page=await context.newPage();
  await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/options/options.html`);
  const result=await page.evaluate(async()=>{
   const {createVisionModel}=await import(chrome.runtime.getURL('offscreen/vision-model.js'));const model=createVisionModel();
   const blob=await (await fetch('https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/cats.png')).blob();
   const image=await createImageBitmap(blob);const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;canvas.getContext('2d').drawImage(image,0,0,320,180);image.close();
   const start=performance.now();const vector=await model.image(canvas.toDataURL('image/jpeg',0.6));const imageMs=Math.round(performance.now()-start);
   const queries=['two cats sitting on a sofa','an airplane at the airport','a red racing car'];const scores=[];
   for(const query of queries){const text=await model.text(query);scores.push(vector.reduce((sum,value,i)=>sum+value*text[i],0))}
   model.release();return {dimension:vector.length,queries,scores,imageMs};
  });
  assert.equal(result.dimension,512);assert.equal(result.scores.indexOf(Math.max(...result.scores)),0);
  console.log('SCENE_MODEL_PASS',JSON.stringify(result));
 } finally {await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
