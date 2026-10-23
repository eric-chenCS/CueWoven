import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discardInvalidTextWeights} from '../offscreen/text-cache.js';

const weight='https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx';
for(const message of ['No graph was found in the protobuf.','Failed to load model because protobuf parsing failed.'])test('invalid text weights are evicted: '+message,async()=>{
  const calls=[],storage={has:async name=>{calls.push(['has',name]);return true;},open:async name=>{calls.push(['open',name]);return{delete:async url=>calls.push(['delete',url])};}};
  await discardInvalidTextWeights(Error(message),storage);
  assert.deepEqual(calls,[['has','transformers-cache'],['open','transformers-cache'],['delete',weight]]);
});
test('offline, HTTP, timeout, runtime and unrelated parser errors preserve cached assets',async()=>{
  let accesses=0;
  for(const message of ['Failed to fetch','Forbidden access to file','The search model timed out','Out of memory','WebAssembly compilation failed','Unexpected token in JSON']){
    await discardInvalidTextWeights(Error(message),{has:async()=>{accesses++;return false;}});
  }
  assert.equal(accesses,0,'unrelated failures must not touch the cache');
});
test('cleanup never creates a cache when none exists',async()=>{
  let checked=false,opened=false;
  await discardInvalidTextWeights(Error('No graph was found in the protobuf'),{has:async()=>{checked=true;return false;},open:async()=>{opened=true;}});
  assert.equal(checked,true);assert.equal(opened,false);
});
for(const stage of ['has','open','delete'])test('a failed cache '+stage+' does not replace the model error',async()=>{
  const fail=()=>{throw Error('Cache unavailable');};
  await assert.doesNotReject(discardInvalidTextWeights(Error('No graph was found in the protobuf'),{has:stage==='has'?fail:async()=>true,open:stage==='open'?fail:async()=>({delete:fail})}));
});
