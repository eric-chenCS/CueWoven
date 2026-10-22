// Keep inference off the document event loop so indexing cannot freeze search UI.
import {pipeline,env} from '../vendor/transformers.bundle.js';
env.allowLocalModels=false;
env.useBrowserCache=true;
env.backends.onnx.wasm.wasmPaths=new URL('../vendor/',import.meta.url).href;
env.backends.onnx.wasm.numThreads=1;
let extractor;
self.onmessage=async({data:{id,texts}})=>{
  try{
    if(!extractor){
      // Avoid V8's streaming-compilation failure path for this bundled runtime.
      const response=await fetch(new URL('../vendor/ort-wasm-simd-threaded.jsep.wasm',import.meta.url));
      if(!response.ok)throw Error('Could not load the local search runtime.');
      env.backends.onnx.wasm.wasmBinary=await response.arrayBuffer();
      try{
        extractor=await pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{
          dtype:'q8',device:'wasm',progress_callback:p=>{if(p.status==='progress')self.postMessage({id,progress:(p.progress||0)/100});},
        });
      }finally{env.backends.onnx.wasm.wasmBinary=undefined;}
    }
    const vectors=[];
    if(texts.length){
      const tensor=await extractor(texts,{pooling:'mean',normalize:true}),dim=tensor.dims.at(-1);
      if(dim!==384)throw Error('Unexpected search model dimensions.');
      for(let i=0;i<texts.length;i++)vectors.push(Float32Array.from(tensor.data.subarray(i*dim,(i+1)*dim)));
    }
    self.postMessage({id,vectors},vectors.map(vec=>vec.buffer));
  }catch(error){self.postMessage({id,error:String(error.message||error)});}
};
