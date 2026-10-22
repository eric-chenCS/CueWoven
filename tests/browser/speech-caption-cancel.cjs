const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const f=await fixture({prepareExtension(extension){
  // Controlled pending inference exercises real Worker termination without downloading Whisper.
  fs.writeFileSync(path.join(extension,'offscreen/speech-worker.js'),`onmessage=({data})=>{if(data.type==='prepare')postMessage({id:data.id,result:{ready:true}});};`);
 }}),report={controlledSpeechWorker:true,errors:[]};
 f.context.on('weberror',event=>report.errors.push(event.error().message));
 try{
  await f.send({type:'status'});
  report.routing=await f.options.evaluate(async()=>{
   const send=data=>chrome.runtime.sendMessage({target:'offscreen',...data});
   const ready=await send({type:'speech-prepare',tabId:71,video:{videoId:'aaaaaaaaaaa'}});
   if(ready.status!=='preparing')throw Error(JSON.stringify(ready));
   const unrelated=await send({type:'speech-cancel-captions',tabId:72,videoId:'aaaaaaaaaaa'});
   if(unrelated.status!=='preparing'||unrelated.id!==ready.id)throw Error('Unrelated session cancelled');
   const stopped=await send({type:'speech-cancel-captions',tabId:71,videoId:'aaaaaaaaaaa'});
   if(stopped.status!=='idle'||stopped.error)throw Error(JSON.stringify(stopped));
   return {scoped:true,stopped:stopped.status};
  });
  report.worker=await f.options.evaluate(async()=>{
   const {createLiveSpeech}=await import(chrome.runtime.getURL('lib/live-speech.js'));
   const {createSpeechModel}=await import(chrome.runtime.getURL('offscreen/speech-model.js'));
   const model=createSpeechModel(),saved=[];let closes=0,time=100;
   const video={videoId:'aaaaaaaaaaa'},controller=createLiveSpeech({prepareModel:model.prepare,transcribe:model.transcribe,releaseModel:model.release,
    openAudio:async()=>({close:async()=>{closes++}}),readClock:async()=>({video,time:++time,rate:1}),save:async data=>{saved.push(data);return {chunkCount:1};}});
   const start=async()=>{const ready=await controller.prepare({tabId:1,video});await controller.start({id:ready.id});};
   try{
    await start();for(let i=0;i<30;i++)await controller.packet(new Float32Array(16000).fill(.1),16000);
    const oldStop=controller.stop(),began=performance.now();controller.cancelForCaptions({tabId:1,videoId:video.videoId});
    const cancelMs=performance.now()-began;
    if(controller.status().status!=='idle')throw Error('Cancellation waited for inference');
    video.videoId='bbbbbbbbbbb';await start();await oldStop;await new Promise(resolve=>setTimeout(resolve,30));
    if(controller.status().status!=='recording'||saved.length)throw Error('Old worker affected the new session');
    controller.cancelForCaptions({tabId:1,videoId:'aaaaaaaaaaa'});
    if(controller.status().status!=='recording')throw Error('Delayed cancellation stopped a different video');
    controller.cancelForCaptions({tabId:1,videoId:video.videoId});
    return {cancelMs,pendingInferenceTerminated:true,restarted:true,closes,saved:saved.length};
   }finally{controller.cancelForCaptions({tabId:1,videoId:video.videoId});model.release();}
  });
  assert.equal(report.worker.closes,2);assert.equal(report.worker.saved,0);assert.deepEqual(report.errors,[]);report.pass=true;
  console.log('SPEECH_CAPTION_CANCEL_PASS',JSON.stringify(report));
 }finally{
  if(process.env.RECALL_REPORT_DIR){fs.mkdirSync(process.env.RECALL_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR,'speech-caption-cancel.json'),JSON.stringify(report,null,2));}
  await f.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
