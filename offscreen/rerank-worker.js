import {pipeline, env} from '../vendor/transformers.bundle.js';
import {RERANK_MODEL, RERANK_REVISION, RERANK_ASSETS} from './rerank-assets.js';
import {readHeadTensor, scoreHead} from './rerank-head.js';
import {createWasmLoader} from './wasm-loader.js';

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.useBrowserCache = false;
env.backends.onnx.wasm.wasmPaths = new URL('../vendor/', import.meta.url).href;
env.backends.onnx.wasm.numThreads = 1;
const cacheName = 'cuewoven-ettin-' + RERANK_REVISION;
const loadModel=createWasmLoader(env);
let model, tokenizer, head, loading;
const assets = new Map(), predictions = new Map();

async function asset(file) {
  const expected = Object.hasOwn(RERANK_ASSETS, file) && RERANK_ASSETS[file];
  if (!expected) throw Error('Unknown reranker asset.');
  if (!assets.has(file)) assets.set(file, (async () => {
    const url = `https://huggingface.co/${RERANK_MODEL}/resolve/${RERANK_REVISION}/${file}`;
    const cache = await caches.open(cacheName).catch(() => null);
    async function verified(response) {
      if (!response?.ok) return null;
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== expected.bytes) return null;
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
      return hash === expected.sha256 ? bytes : null;
    }
    let bytes = await verified(await cache?.match(url)).catch(() => null);
    if (!bytes) {
      await cache?.delete(url);
      bytes = await verified(await fetch(url, {credentials: 'omit', referrerPolicy: 'no-referrer'}));
      if (!bytes) throw Error('Reranker model verification failed.');
      await cache?.put(url, new Response(bytes)).catch(() => {});
    }
    return bytes;
  })());
  return assets.get(file);
}

// Only these pinned, hash-verified data files may satisfy the model loader.
env.useCustomCache = true;
env.customCache = {
  async match(request) {
    const value = String(request?.url || request), marker = RERANK_MODEL + '/', at = value.indexOf(marker);
    if (at < 0) return undefined;
    const file = value.slice(at + marker.length).replace(`resolve/${RERANK_REVISION}/`, '');
    return Object.hasOwn(RERANK_ASSETS, file) ? new Response(await asset(file)) : undefined;
  },
  async put() {},
};

async function load() {
  const options = {revision: RERANK_REVISION, device: 'wasm', dtype: 'fp32', model_file_name: 'model_quint8_avx2'};
  // The explicit file is q8; fp32 here prevents the loader adding a filename suffix.
  const [loaded, dense, norm, output] = await Promise.all([
    loadModel(()=>pipeline('feature-extraction', RERANK_MODEL, options)),
    asset('2_Dense/model.safetensors'), asset('3_LayerNorm/model.safetensors'), asset('4_Dense/model.safetensors'),
  ]);
  model = loaded.model; tokenizer = loaded.tokenizer;
  head = {dense: readHeadTensor(dense, 'linear.weight', [384, 384]), norm: readHeadTensor(norm, 'norm.weight', [384]), normBias: readHeadTensor(norm, 'norm.bias', [384]), output: readHeadTensor(output, 'linear.weight', [1, 384]), bias: readHeadTensor(output, 'linear.bias', [1])};
  assets.clear();
}

self.onmessage = async ({data}) => {
  const {id, type, query, documents} = data || {};
  try {
    if (type === 'init') {
      loading ||= load(); await loading;
      self.postMessage({id, ready: true}); return;
    }
    if (type !== 'score' || !head || typeof query !== 'string' || !query.trim() || query.length > 2000 || !Array.isArray(documents) || documents.length < 2 || documents.length > 10 || !documents.every(text => typeof text === 'string' && text.length <= 8192)) throw Error('Invalid reranker request.');
    const key = JSON.stringify([query, documents]);
    let scores = predictions.get(key);
    if (!scores) {
      const tokens = tokenizer(documents.map(() => query), {text_pair: documents, padding: true, truncation: true, max_length: 256});
      const result = await model(tokens);
      scores = scoreHead(result.last_hidden_state, head);
      predictions.set(key, scores);
      while (predictions.size > 8) predictions.delete(predictions.keys().next().value);
    }
    self.postMessage({id, scores});
  } catch {
    self.postMessage({id, error: 'Local reranking unavailable.'});
  }
};
