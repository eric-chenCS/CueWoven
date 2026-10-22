// A module worker keeps the optional speech model off the search document's thread.
import {pipeline, env} from '../vendor/transformers.bundle.js';
import {createWasmLoader} from './wasm-loader.js';
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = new URL('../vendor/', import.meta.url).href;
env.backends.onnx.wasm.numThreads = 1;
const loadModel=createWasmLoader(env);
let recognizer;
self.onmessage = async ({data}) => {
  const {id, type, pcm} = data;
  try {
    if (!recognizer) recognizer = await loadModel(()=>pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
      dtype: 'q8', device: 'wasm', progress_callback: p => {if (p.status === 'progress') self.postMessage({id, progress: p.progress / 100});},
    }));
    const result = type === 'transcribe' ? await recognizer(pcm, {return_timestamps: true, chunk_length_s: 30, stride_length_s: 0}) : {ready: true};
    self.postMessage({id, result});
  } catch (error) {self.postMessage({id, error: String(error.message || error)});}
};
