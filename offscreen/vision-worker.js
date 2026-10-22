import {env, AutoTokenizer, AutoProcessor, CLIPTextModelWithProjection, CLIPVisionModelWithProjection, RawImage} from '../vendor/transformers.bundle.js';
import {createWasmLoader} from './wasm-loader.js';
const MODEL = 'Xenova/clip-vit-base-patch32';
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = new URL('../vendor/', import.meta.url).href;
env.backends.onnx.wasm.numThreads = 1;
const loadModel=createWasmLoader(env);
let vision, text, processor, tokenizer;
function normalized(tensor) {
  const values = Float32Array.from(tensor.data), length = Math.hypot(...values);
  if (values.length !== 512 || !Number.isFinite(length) || !length) throw new Error('Invalid scene embedding.');
  return values.map(value => value / length);
}
self.onmessage = async ({data}) => {
  const {id, type, image, query} = data;
  const options = {dtype: 'q8', device: 'wasm', progress_callback: p => {if (p.status === 'progress') self.postMessage({id, progress: p.progress / 100});}};
  try {
    let vector;
    if (type === 'image') {
      processor ||= await AutoProcessor.from_pretrained(MODEL);
      vision ||= await loadModel(()=>CLIPVisionModelWithProjection.from_pretrained(MODEL, options));
      const raw = await RawImage.fromBlob(await (await fetch(image)).blob());
      vector = normalized((await vision(await processor(raw))).image_embeds);
    } else if (type === 'text') {
      tokenizer ||= await AutoTokenizer.from_pretrained(MODEL);
      text ||= await loadModel(()=>CLIPTextModelWithProjection.from_pretrained(MODEL, options));
      vector = normalized((await text(tokenizer(query, {padding: true, truncation: true}))).text_embeds);
    } else throw new Error('Invalid scene model operation.');
    self.postMessage({id, result: vector}, [vector.buffer]);
  } catch (error) {self.postMessage({id, error: String(error.message || error)});}
};
