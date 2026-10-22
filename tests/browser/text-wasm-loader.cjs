const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const report={checks:[]};
(async()=>{
 for(const fault of ['missing','corrupt']){
  const f=await fixture({prepareExtension(extension){
   const file=path.join(extension,'offscreen/text-worker.js');
   const probe=`
let streamingCalls=0,wasmRequests=0;
const fault=new URL(import.meta.url).searchParams.get('fault');
const originalStreaming=WebAssembly.instantiateStreaming;
WebAssembly.instantiateStreaming=(...args)=>{streamingCalls++;return originalStreaming(...args);};
const originalFetch=fetch;
globalThis.fetch=(url,...args)=>{
 if(String(url).endsWith('.wasm')){
  wasmRequests++;
  if(fault==='missing')return Promise.resolve(new Response('',{status:404}));
  if(fault==='corrupt')return Promise.resolve(new Response(new Uint8Array([1,2,3,4])));
 }
 return originalFetch(url,...args);
};
const originalPost=self.postMessage.bind(self);
self.postMessage=(data,...args)=>originalPost({...data,loaderProbe:{streamingCalls,wasmRequests,binaryConfigured:env.backends.onnx.wasm.wasmBinary!==undefined}},...args);
`;
   fs.writeFileSync(file,probe+fs.readFileSync(file,'utf8'));
  }});
  try{
   const result=await f.options.evaluate(async fault=>{
    const {createTextModel}=await import(chrome.runtime.getURL('offscreen/text-model.js')),workers=[],probes=[];
    class ObservedWorker extends Worker{
     constructor(url,options){const index=workers.length,next=new URL(url);if(!index)next.searchParams.set('fault',fault);super(next,options);workers.push(this);this.addEventListener('message',({data})=>{if(data.loaderProbe)probes[index]=data.loaderProbe;});}
    }
    const model=createTextModel(()=>{},{WorkerClass:ObservedWorker});
    try{
     const failed=await model.warmup().then(()=>null,error=>error.message);
     if(!failed)throw Error('Invalid runtime unexpectedly loaded');
     const vectors=await model.embed(['The speaker says aging is not fun and his back hurts.','Warm ocean water causes coral bleaching.']);
     await model.warmup();
     return{failed,workers:workers.length,probes,dimensions:vectors.map(vector=>vector.length),finite:vectors.every(vector=>vector.every(Number.isFinite))};
    }finally{model.release();}
   },fault);
   assert.equal(result.workers,2);assert.deepEqual(result.dimensions,[384,384]);assert.equal(result.finite,true);
   if(fault==='missing')assert.match(result.failed,/Could not load the local search runtime/);
   for(const probe of result.probes)assert.deepEqual(probe,{streamingCalls:0,wasmRequests:1,binaryConfigured:false});
   report.checks.push({fault,...result});
  }finally{await f.close();}
 }
 report.pass=true;
 if(process.env.RECALL_REPORT_DIR){fs.mkdirSync(process.env.RECALL_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR,'text-wasm-loader.json'),JSON.stringify(report,null,2));}
 console.log('TEXT_WASM_LOADER_PASS',JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1});
