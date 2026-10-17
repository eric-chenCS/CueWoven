const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright'),fs=require('fs'),path=require('path'),os=require('os');
const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..');
const reference='Battery charging cycles damage the electrodes and reduce energy capacity. Chemical reactions explain why a phone battery stores less charge over time. Recall saves the words you actually hear while watching a video.';
function errorRate(actual){const tokens=text=>text.toLowerCase().match(/[a-z]+/g)||[],a=tokens(reference),b=tokens(actual);let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,row[j+1]+1,row[j]+(a[i]===b[j]?0:1)));row=next}return Math.round(row.at(-1)/a.length*1000)/1000}
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-speech-eval-')),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 try {
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),page=await context.newPage();await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/options/options.html`);
  const results=await page.evaluate(async encoded=>{
   const {pipeline,env}=await import(chrome.runtime.getURL('vendor/transformers.bundle.js'));env.allowLocalModels=false;env.useBrowserCache=true;env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.wasmPaths=chrome.runtime.getURL('vendor/');
   const context=new AudioContext({sampleRate:16000}),bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),decoded=await context.decodeAudioData(bytes.buffer);await context.close();
   const clean=decoded.getChannelData(0),noisy=clean.slice();let seed=37;for(let i=0;i<noisy.length;i++){seed=(1664525*seed+1013904223)>>>0;noisy[i]+=(seed/4294967296-0.5)*0.08}
   const fast=new Float32Array(Math.floor(clean.length/1.25));for(let i=0;i<fast.length;i++)fast[i]=clean[Math.floor(i*1.25)];
   const results=[];for(const model of ['Xenova/whisper-tiny.en','Xenova/whisper-base.en']){
    const loading=performance.now(),recognizer=await pipeline('automatic-speech-recognition',model,{dtype:'q8',device:'wasm'}),loadMs=Math.round(performance.now()-loading);
    for(const [sample,pcm] of [['clean',clean],['noise',noisy],['speed-1.25',fast]]){const start=performance.now(),result=await recognizer(pcm,{return_timestamps:true,chunk_length_s:30,stride_length_s:0});results.push({model,sample,text:result.text,loadMs,inferenceMs:Math.round(performance.now()-start),audioSeconds:pcm.length/16000})}await recognizer.dispose();
   }return results;
  },fs.readFileSync(process.env.RECALL_SPEECH_WAV).toString('base64'));
  const report={testedAt:new Date().toISOString(),reference,results:results.map(result=>({...result,wordErrorRate:errorRate(result.text)}))};
  if(process.env.RECALL_SCREENSHOT_DIR)fs.writeFileSync(path.join(process.env.RECALL_SCREENSHOT_DIR,'recall-speech-eval.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
