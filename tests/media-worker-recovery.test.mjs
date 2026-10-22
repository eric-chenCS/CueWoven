import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createVisionModel} from '../offscreen/vision-model.js';
import {createSpeechModel} from '../offscreen/speech-model.js';

for(const kind of ['vision','speech']){
  function fixture(t){
    t.mock.timers.enable({apis:['setTimeout']});
    const previous=globalThis.Worker,workers=[];
    globalThis.Worker=class extends EventTarget{
      constructor(){super();this.sent=[];workers.push(this);}
      postMessage(message){this.sent.push(message);}
      answer(){this.onmessage({data:{id:this.sent.at(-1).id,result:kind==='vision'?Float32Array.of(.5):{text:'Recognized words'}}});}
      terminate(){this.terminated=true;}
    };
    const model=kind==='vision'?createVisionModel():createSpeechModel();
    t.after(async()=>{await Promise.resolve();model.release();globalThis.Worker=previous;});
    return {model,workers,call:()=>kind==='vision'?model.text('a remembered scene'):model.prepare()};
  }
  test(`retired ${kind} worker errors cannot stop new inference`,async t=>{
    const {model,workers,call}=fixture(t),first=call();workers[0].answer();await first;
    const late=workers[0].onerror;model.release();
    const next=call(),result=next.catch(error=>error);late();
    assert.ok(!workers[1].terminated);workers[1].answer();assert.ok(!((await result) instanceof Error));
  });
  test(`${kind} message-transfer failures settle pending work and permit retry`,async t=>{
    const {workers,call}=fixture(t),pending=call(),queued=call(),result=Promise.allSettled([pending,queued]);
    workers[0].dispatchEvent(new Event('messageerror'));assert.equal(workers[0].terminated,true);
    assert.ok((await result).every(row=>row.status==='rejected'));assert.equal(workers[0].terminated,true);
    const retry=call();workers[1].answer();await retry;
  });
}
