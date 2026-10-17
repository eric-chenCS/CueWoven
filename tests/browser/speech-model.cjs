const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=process.env.RECALL_EXTENSION || path.resolve(__dirname,'../..');
(async()=>{const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-speech-model-')),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});try{
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const page=await context.newPage();page.on('pageerror',e=>console.error('PAGE_ERROR',String(e)));
 await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/options/options.html`);
 const result=await page.evaluate(async encoded=>{
  const {createSpeechModel}=await import(chrome.runtime.getURL('offscreen/speech-model.js'));
  const model=createSpeechModel(),context=new AudioContext({sampleRate:16000});
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));const buffer=await context.decodeAudioData(bytes.buffer);await context.close();
  const start=performance.now();await model.prepare();const ready=performance.now();
  const result=await model.transcribe(buffer.getChannelData(0).slice());model.release();
  return {...result,loadMs:Math.round(ready-start),inferenceMs:Math.round(performance.now()-ready),audioSeconds:buffer.duration};
 },fs.readFileSync(process.env.RECALL_SPEECH_WAV).toString('base64'));
 assert.match(result.text,/battery/i);assert.match(result.text,/charg/i);assert.ok(result.chunks.length&&result.chunks.every(c=>Array.isArray(c.timestamp)));
 console.log('SPEECH_MODEL_PASS',JSON.stringify(result));
}finally{await context.close()}})().catch(e=>{console.error(e);process.exitCode=1});
