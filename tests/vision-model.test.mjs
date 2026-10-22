import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createVisionModel} from '../offscreen/vision-model.js';
test('visual inference is bounded, with only the newest waiting query retained',async()=>{
  const previous=globalThis.Worker,workers=[];
  globalThis.Worker=class extends EventTarget {constructor(){super();workers.push(this)}requests=[];postMessage(message){this.requests.push(message)}terminate(){this.terminated=true}};
  const model=createVisionModel();
  try {
    const image=model.image('fixture');await assert.rejects(model.image('second'),/busy/);
    const old=model.text('old query'),replaced=assert.rejects(old,/newer/),latest=model.text('new query');await replaced;
    const worker=workers[0];assert.equal(worker.requests.length,1);
    worker.onmessage({data:{id:worker.requests[0].id,result:new Float32Array(512)}});await image;
    assert.equal(worker.requests.length,2);assert.equal(worker.requests[1].query,'new query');
    worker.onmessage({data:{id:worker.requests[1].id,result:new Float32Array(512)}});await latest;
    assert.equal(workers.length,1);
  }finally{model.release();globalThis.Worker=previous}
});
test('canceling visual inference rejects active and waiting work and permits retry',async()=>{
  const previous=globalThis.Worker,workers=[];
  globalThis.Worker=class extends EventTarget {constructor(){super();workers.push(this)}requests=[];postMessage(message){this.requests.push(message)}terminate(){this.terminated=true}};
  const model=createVisionModel();
  try {
    const image=model.image('fixture'),query=model.text('waiting');
    const rejected=[assert.rejects(image,/stopped/),assert.rejects(query,/stopped/)];
    model.release();await Promise.all(rejected);assert.equal(workers[0].terminated,true);
    const retry=model.text('retry'),worker=workers[1];worker.onmessage({data:{id:worker.requests[0].id,result:new Float32Array(512)}});await retry;
  }finally{model.release();globalThis.Worker=previous}
});

test('explicit visual prewarming loads the text model once and a real query reuses its worker',async()=>{
 const previous=globalThis.Worker,workers=[];globalThis.Worker=class extends EventTarget {constructor(){super();workers.push(this)}requests=[];postMessage(message){this.requests.push(message)}terminate(){}};
 const model=createVisionModel();try{
  const warm=model.warmup();assert.equal(model.warmup(),warm);const worker=workers[0];assert.equal(worker.requests[0].type,'text');
  worker.onmessage({data:{id:worker.requests[0].id,result:new Float32Array(512)}});await warm;
  const search=model.text('cats');assert.equal(workers.length,1);worker.onmessage({data:{id:worker.requests[1].id,result:new Float32Array(512)}});await search;
 }finally{model.release();globalThis.Worker=previous}
});

test('image restore waits for prewarming instead of failing busy',async()=>{
 const previous=globalThis.Worker,workers=[];globalThis.Worker=class extends EventTarget {constructor(){super();workers.push(this)}requests=[];postMessage(message){this.requests.push(message)}terminate(){}};
 const model=createVisionModel();try{
  const warm=model.warmup(),image=model.image('fixture'),worker=workers[0];assert.equal(worker.requests.length,1);
  worker.onmessage({data:{id:worker.requests[0].id,result:new Float32Array(512)}});await warm;await new Promise(resolve=>setImmediate(resolve));assert.equal(worker.requests[1].type,'image');
  worker.onmessage({data:{id:worker.requests[1].id,result:new Float32Array(512)}});await image;
 }finally{model.release();globalThis.Worker=previous}
});
