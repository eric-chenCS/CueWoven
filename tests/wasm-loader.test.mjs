import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWasmLoader} from '../offscreen/wasm-loader.js';

function fixture(fetcher){
  const env={backends:{onnx:{wasm:{}}}},requests=[];
  const load=createWasmLoader(env,{fetcher:async url=>{requests.push(url);return fetcher?fetcher():new Response(new Uint8Array([1,2,3]));}});
  return{env,requests,load};
}
test('runtime bytes are local, cleared after initialization, and not refetched for another model',async()=>{
  const {env,requests,load}=fixture();
  assert.equal(await load(()=>{assert.equal(env.backends.onnx.wasm.wasmBinary.byteLength,3);return 'vision';}),'vision');
  assert.equal(env.backends.onnx.wasm.wasmBinary,undefined);
  assert.equal(await load(()=>{assert.equal(env.backends.onnx.wasm.wasmBinary,undefined);return 'text';}),'text');
  assert.equal(requests.length,1);assert.ok(requests[0].pathname.endsWith('/vendor/ort-wasm-simd-threaded.jsep.wasm'));
});
test('concurrent first model loads share runtime initialization and each keep their own result',async()=>{
  const {load,requests}=fixture();let finish,secondStarted=false;
  const first=load(()=>new Promise(resolve=>{finish=resolve;}));
  const second=load(()=>{secondStarted=true;return 'second';});
  while(!finish)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(secondStarted,false);assert.equal(requests.length,1);finish('first');
  assert.deepEqual(await Promise.all([first,second]),['first','second']);
});
test('failed model initialization clears runtime configuration and permits another attempt',async()=>{
  const {env,requests,load}=fixture();
  await assert.rejects(load(()=>{throw Error('model failure');}),/model failure/);
  assert.equal(env.backends.onnx.wasm.wasmBinary,undefined);
  assert.equal(await load(()=>'recovered'),'recovered');assert.equal(requests.length,2);
});
test('concurrent callers settle when initial model loading fails, and later retry is not wedged',async()=>{
  const {load,env,requests}=fixture();let fail,secondStarted=false;
  const first=load(()=>new Promise((resolve,reject)=>{fail=reject;}));
  const second=load(()=>{secondStarted=true;});
  const settled=Promise.allSettled([first,second]);
  while(!fail)await new Promise(resolve=>setImmediate(resolve));fail(Error('initial failure'));
  assert.ok((await settled).every(row=>row.status==='rejected'&&/initial failure/.test(row.reason.message)));
  assert.equal(secondStarted,false);assert.equal(env.backends.onnx.wasm.wasmBinary,undefined);
  assert.equal(await load(()=>'retried'),'retried');assert.equal(requests.length,2);
});
for(const fault of ['missing','fetch','body'])test(`runtime ${fault} failure never starts the model`,async()=>{
  const {env,load}=fixture(()=>{
    if(fault==='fetch')throw Error('fetch failed');
    return fault==='missing'?new Response('',{status:404}):{ok:true,arrayBuffer:()=>Promise.reject(Error('body failed'))};
  });let started=false;
  await assert.rejects(load(()=>{started=true;}),/runtime|failed/);
  assert.equal(started,false);assert.equal(env.backends.onnx.wasm.wasmBinary,undefined);
});
