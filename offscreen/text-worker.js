// Keep inference off the document event loop so indexing cannot freeze search UI.
import {pipeline,env} from '../vendor/transformers.bundle.js';
import {createWasmLoader} from './wasm-loader.js';
env.allowLocalModels=false;
env.useBrowserCache=true;
env.backends.onnx.wasm.wasmPaths=new URL('../vendor/',import.meta.url).href;
env.backends.onnx.wasm.numThreads=1;
const loadModel=createWasmLoader(env);
let extractor;
self.onmessage=async({data:{id,texts}})=>{
  try{
    extractor ||= await loadModel(()=>pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{
      dtype:'q8',device:'wasm',progress_callback:p=>{if(p.status==='progress')self.postMessage({id,progress:(p.progress||0)/100});},
    }));
    const vectors=[];
    if(texts.length){
      const tensor=await extractor(texts,{pooling:'mean',normalize:true}),dim=tensor.dims.at(-1);
      if(dim!==384)throw Error('Unexpected search model dimensions.');
      for(let i=0;i<texts.length;i++)vectors.push(Float32Array.from(tensor.data.subarray(i*dim,(i+1)*dim)));
    }
    self.postMessage({id,vectors},vectors.map(vec=>vec.buffer));
  }catch(error){self.postMessage({id,error:String(error.message||error)});}
};
