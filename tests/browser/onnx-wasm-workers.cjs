// Optional real-model check: Whisper, CLIP and pinned Ettin fixtures are required.
const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 assert.ok(process.env.RECALL_SPEECH_MODEL_DIR,'Set RECALL_SPEECH_MODEL_DIR');
 assert.ok(process.env.RECALL_SPEECH_WAV,'Set RECALL_SPEECH_WAV');
 assert.ok(process.env.RECALL_ETTIN_MODELS,'Set RECALL_ETTIN_MODELS');
 const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..'),assets=await import(pathToFileURL(path.join(root,'offscreen/rerank-assets.js')).href),report={checks:[]};
 for(const model of ['speech','vision','rerank'])for(const fault of ['missing','corrupt']){
  const f=await fixture({prepareExtension(extension){
   const file=path.join(extension,'offscreen',model+'-worker.js');let source=fs.readFileSync(file,'utf8');
   if(model==='speech'){
    fs.cpSync(process.env.RECALL_SPEECH_MODEL_DIR,path.join(extension,'test-models/Xenova/whisper-tiny.en'),{recursive:true});
    source=source.replace(/env.allowLocalModels\s*=\s*false;/,"env.allowLocalModels=true;env.allowRemoteModels=false;env.localModelPath=new URL('../test-models/',import.meta.url).href;").replace(/env.useBrowserCache\s*=\s*true;/,'env.useBrowserCache=false;');
   }
   const probe=`
let streamingCalls=0,wasmRequests=0;const fault=new URL(import.meta.url).searchParams.get('fault');
const nativeStreaming=WebAssembly.instantiateStreaming;WebAssembly.instantiateStreaming=(...args)=>{streamingCalls++;return nativeStreaming(...args);};
const nativeFetch=fetch;globalThis.fetch=(url,...args)=>{if(String(url).endsWith('.wasm')){wasmRequests++;if(fault==='missing')return Promise.resolve(new Response('',{status:404}));if(fault==='corrupt')return Promise.resolve(new Response(new Uint8Array([1,2,3,4])));}return nativeFetch(url,...args);};
const nativePost=self.postMessage.bind(self);self.postMessage=(data,...args)=>nativePost({...data,loaderProbe:{streamingCalls,wasmRequests,binaryConfigured:env.backends.onnx.wasm.wasmBinary!==undefined}},...args);
`;
   fs.writeFileSync(file,probe+source);
  }});
  try{
   if(model==='rerank'){
    const prefix=`https://huggingface.co/${assets.RERANK_MODEL}/resolve/${assets.RERANK_REVISION}/`;
    await f.context.route(prefix+'**',route=>{const file=route.request().url().slice(prefix.length);assert.ok(Object.hasOwn(assets.RERANK_ASSETS,file));return route.fulfill({body:fs.readFileSync(path.join(process.env.RECALL_ETTIN_MODELS,file)),contentType:'application/octet-stream'});});
   }
   const result=await f.options.evaluate(async({model,fault,audio})=>{
    const probes=[];let failed;
    for(const bad of [true,false]){
     const url=new URL(chrome.runtime.getURL('offscreen/'+model+'-worker.js'));if(bad)url.searchParams.set('fault',fault);
     const worker=new Worker(url,{type:'module'});let id=0,last;
     const call=body=>new Promise((resolve,reject)=>{const request=++id,timer=setTimeout(()=>reject(Error('Runtime test timed out')),30000);worker.onmessage=({data})=>{if(data.id!==request||'progress'in data)return;clearTimeout(timer);last=data.loaderProbe;resolve(data);};worker.onerror=event=>{clearTimeout(timer);reject(Error(event.message));};worker.postMessage({id:request,...body});});
     try{
      const init=await call(model==='speech'?{type:'prepare'}:model==='vision'?{type:'text',query:'a red square on white'}:{type:'init'});
      if(bad){if(!init.error)throw Error('Invalid runtime unexpectedly loaded');failed=init.error;}
      else{
       if(init.error)throw Error(init.error);
       if(model==='speech'){
        const context=new AudioContext({sampleRate:16000});try{const decoded=await context.decodeAudioData(Uint8Array.from(atob(audio),c=>c.charCodeAt(0)).buffer);const spoken=await call({type:'transcribe',pcm:decoded.getChannelData(0).slice()});if(spoken.error||!spoken.result.text.trim())throw Error('Speech did not recover');}finally{await context.close();}
       }else if(model==='vision'){
        if(init.result.length!==512)throw Error('Text encoder did not recover');
        const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;canvas.getContext('2d').fillRect(0,0,64,64);
        const image=await call({type:'image',image:canvas.toDataURL('image/png')});if(image.error||image.result.length!==512)throw Error('Image encoder did not recover');
       }else{
        const scored=await call({type:'score',query:'Which planet is known as the Red Planet?',documents:["Venus is often called Earth's twin because of its similar size and proximity.",'Mars, known for its reddish appearance, is often referred to as the Red Planet.','Jupiter, the largest planet in our solar system, has a prominent red spot.','Saturn, famous for its rings, is sometimes mistaken for the Red Planet.']});
        if(scored.error||Math.abs(scored.scores[1]-10.606649398803711)>.001||scored.scores.indexOf(Math.max(...scored.scores))!==1)throw Error('Reranker did not recover');
       }
      }
      probes.push(last);
     }finally{worker.terminate();}
    }
    return{failed,probes};
   },{model,fault,audio:model==='speech'?fs.readFileSync(process.env.RECALL_SPEECH_WAV).toString('base64'):null});
   for(const probe of result.probes)assert.deepEqual(probe,{streamingCalls:0,wasmRequests:1,binaryConfigured:false});
   report.checks.push({model,fault,...result});
  }finally{await f.close();}
 }
 report.pass=true;if(process.env.RECALL_REPORT_DIR){fs.mkdirSync(process.env.RECALL_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR,'onnx-wasm-workers.json'),JSON.stringify(report,null,2));}
 console.log('ONNX_WASM_WORKERS_PASS',JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1});
