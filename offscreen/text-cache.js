const CACHE='transformers-cache';
const WEIGHTS='https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx';

export async function discardInvalidTextWeights(error,cacheStorage=globalThis.caches){
  // Runtime/offline failures must not evict usable downloads or other models.
  if(!/No graph was found in the protobuf|protobuf parsing failed/i.test(String(error?.message||error)))return;
  try{
    if(await cacheStorage.has(CACHE))await(await cacheStorage.open(CACHE)).delete(WEIGHTS);
  }catch{/* Cache cleanup must not replace the original model error. */}
}
