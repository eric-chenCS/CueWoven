import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOcrModel} from '../offscreen/ocr-model.js';
const output=text=>({data:{blocks:[{paragraphs:[{lines:[{confidence:95,words:[{text,confidence:95}]}]}]}]}});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('OCR preserves separate subtitle lines for conservative watermark deduplication',async()=>{
  const words=['NEWS LIVE','The dose is 10 mg.'];
  const data={blocks:[{paragraphs:[{lines:words.map(text=>({confidence:95,words:[{text,confidence:95}]}))}]}]};
  const model=createOcrModel(()=>{},async()=>({worker:{setParameters:async()=>{},recognize:async()=>({data}),terminate(){}},PSM:{SINGLE_BLOCK:6,AUTO:3}}));
  try{const result=await model.read('image',1280,720);assert.deepEqual(result.lines,words);assert.equal(result.text,words.join(' '));}finally{model.release();}
});
test('OCR serializes inference, merges subtitle fragments, reuses and releases the worker',async()=>{
  let reads=0,loads=0,terminated=0,finish;const worker={setParameters:async()=>{},recognize:async()=>{reads++;if(reads===1)await new Promise(resolve=>finish=resolve);return output(reads%2?'Chemical reactions trap lithium.':'Chemical reactions');},terminate(){terminated++}};
  const model=createOcrModel(()=>{},async()=>{loads++;return {worker,PSM:{SINGLE_BLOCK:6,AUTO:3}}});
  try{const first=model.read('image',1280,720);await flush();assert.deepEqual(await model.read('dropped',1280,720),{busy:true});finish();assert.equal((await first).text,'Chemical reactions trap lithium.');await model.read('next',1280,720);assert.equal(loads,1);assert.equal(reads,4);}finally{model.release();}assert.equal(terminated,1);
});
test('canceling during model loading disposes the late worker and permits retry',async()=>{
  let finish,terminated=0,loads=0;const worker={setParameters:async()=>{},recognize:async()=>output('Readable subtitle'),terminate(){terminated++}};
  const model=createOcrModel(()=>{},async()=>{if(++loads===1)await new Promise(resolve=>finish=resolve);return {worker,PSM:{SINGLE_BLOCK:6,AUTO:3}}});
  try{const first=model.read('image',1280,720),failed=assert.rejects(first,/stopped/);model.release();await failed;finish();await flush();assert.equal(terminated,1);assert.equal((await model.read('retry',1280,720)).text,'Readable subtitle');}finally{model.release();}
});
test('stalled OCR has a deadline and idle workers release memory',async()=>{
  let terminated=0;const model=createOcrModel(()=>{},async()=>({worker:{setParameters:async()=>{},recognize:()=>new Promise(()=>{}),terminate(){terminated++}},PSM:{SINGLE_BLOCK:6,AUTO:3}}),{timeoutMs:15,idleMs:10});
  await assert.rejects(model.read('image',1280,720),/stopped/);assert.equal(terminated,1);
  const idle=createOcrModel(()=>{},async()=>({worker:{setParameters:async()=>{},recognize:async()=>output('Readable'),terminate(){terminated++}},PSM:{SINGLE_BLOCK:6,AUTO:3}}),{idleMs:10});
  await idle.read('image',1280,720);await new Promise(resolve=>setTimeout(resolve,25));assert.equal(terminated,2);idle.release();
});

test('OCR replaces a subtitle fragment with the fuller full-frame line',async()=>{
  const reads=['Chemical reactions','Chemical reactions trap lithium.'];let index=0;
  const model=createOcrModel(()=>{},async()=>({worker:{setParameters:async()=>{},recognize:async()=>output(reads[index++]),terminate(){}},PSM:{SINGLE_BLOCK:6,AUTO:3}}));
  try{assert.deepEqual((await model.read('image',1280,720)).lines,['Chemical reactions trap lithium.']);}finally{model.release();}
});

test('invalid OCR dimensions are rejected before loading a worker',async()=>{
  let loads=0;
  const model=createOcrModel(()=>{},async()=>{loads++;throw Error('must not load');});
  try{for(const [width,height] of [[0,720],[1280,0],[-1,720],[NaN,720],[1280,Infinity],[1281,720],[1280,721],[1.5,720],['1280',720]]){
    await assert.rejects(model.read('image',width,height),/Invalid screenshot dimensions/);
  }assert.equal(loads,0);}finally{model.release();}
});

test('throwing or rejecting worker cleanup cannot mask OCR failures or prevent retry',async()=>{
  for(const rejection of [false,true]){
    let reads=0,terminated=0;
    const model=createOcrModel(()=>{},async()=>({worker:{setParameters:async()=>{},recognize:async()=>{if(++reads===1)throw Error('recognition failed');return output('Readable caption');},terminate(){terminated++;if(rejection)return Promise.reject(Error('cleanup failed'));throw Error('cleanup failed');}},PSM:{SINGLE_BLOCK:6,AUTO:3}}));
    try{await assert.rejects(model.read('image',1280,720),/recognition failed/);assert.equal((await model.read('retry',1280,720)).text,'Readable caption');}
    finally{model.release();}
    await flush();assert.equal(terminated,2);
  }
});
