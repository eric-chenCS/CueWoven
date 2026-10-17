import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOcrModel} from '../offscreen/ocr-model.js';
const output=text=>({data:{blocks:[{paragraphs:[{lines:[{confidence:95,words:[{text,confidence:95}]}]}]}]}});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('OCR serializes inference, merges subtitle fragments, reuses and releases the worker',async()=>{
  let reads=0,loads=0,terminated=0,finish;const worker={setParameters:async()=>{},recognize:async()=>{reads++;if(reads===1)await new Promise(resolve=>finish=resolve);return output(reads%2?'Chemical reactions trap lithium.':'Chemical reactions');},terminate(){terminated++}};
  const model=createOcrModel(()=>{},async()=>{loads++;return {worker,PSM:{SINGLE_BLOCK:6,SPARSE_TEXT:11}}});
  try{const first=model.read('image',1280,720);await flush();assert.deepEqual(await model.read('dropped',1280,720),{busy:true});finish();assert.equal((await first).text,'Chemical reactions trap lithium.');await model.read('next',1280,720);assert.equal(loads,1);assert.equal(reads,4);}finally{model.release();}assert.equal(terminated,1);
});
test('canceling during model loading disposes the late worker and permits retry',async()=>{
  let finish,terminated=0,loads=0;const worker={setParameters:async()=>{},recognize:async()=>output('Readable subtitle'),terminate(){terminated++}};
  const model=createOcrModel(()=>{},async()=>{if(++loads===1)await new Promise(resolve=>finish=resolve);return {worker,PSM:{SINGLE_BLOCK:6,SPARSE_TEXT:11}}});
  try{const first=model.read('image',1280,720),failed=assert.rejects(first,/stopped/);model.release();await failed;finish();await flush();assert.equal(terminated,1);assert.equal((await model.read('retry',1280,720)).text,'Readable subtitle');}finally{model.release();}
});
test('stalled OCR has a deadline and idle workers release memory',async()=>{
  let terminated=0;const model=createOcrModel(()=>{},async()=>({worker:{setParameters:async()=>{},recognize:()=>new Promise(()=>{}),terminate(){terminated++}},PSM:{SINGLE_BLOCK:6,SPARSE_TEXT:11}}),{timeoutMs:15,idleMs:10});
  await assert.rejects(model.read('image',1280,720),/stopped/);assert.equal(terminated,1);
  const idle=createOcrModel(()=>{},async()=>({worker:{setParameters:async()=>{},recognize:async()=>output('Readable'),terminate(){terminated++}},PSM:{SINGLE_BLOCK:6,SPARSE_TEXT:11}}),{idleMs:10});
  await idle.read('image',1280,720);await new Promise(resolve=>setTimeout(resolve,25));assert.equal(terminated,2);idle.release();
});
