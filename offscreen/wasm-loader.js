// One initialization per worker; later models reuse ONNX's initialized runtime.
export function createWasmLoader(env,{fetcher=fetch}={}){
  let ready=false,pending;
  async function initialize(load){
    const response=await fetcher(new URL('../vendor/ort-wasm-simd-threaded.jsep.wasm',import.meta.url));
    if(!response.ok)throw Error('Could not load the local model runtime.');
    env.backends.onnx.wasm.wasmBinary=await response.arrayBuffer();
    try{
      const model=await load();ready=true;return model;
    }finally{env.backends.onnx.wasm.wasmBinary=undefined;}
  }
  return async load=>{
    if(pending)await pending;
    if(ready)return load();
    pending=initialize(load);
    try{return await pending;}finally{pending=null;}
  };
}
