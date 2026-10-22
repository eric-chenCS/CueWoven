import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTextModel} from '../offscreen/text-model.js';

function fixture(t){
  t.mock.timers.enable({apis:['setTimeout']});
  const workers=[];
  class Worker extends EventTarget {
    constructor(){super();this.sent=[];workers.push(this);}
    postMessage(message){this.sent.push(message);}
    answer(){const {id,texts}=this.sent.at(-1);this.onmessage({data:{id,vectors:texts.map(text=>Float32Array.of(Number(text)))}});}
    terminate(){this.terminated=true;}
  }
  return {workers,model:createTextModel(()=>{},{WorkerClass:Worker,idleMs:10,timeoutMs:50})};
}

for(const reason of ['release','idle','timeout'])test(`late errors from a worker retired by ${reason} cannot cancel its replacement`,async t=>{
  const {workers,model}=fixture(t);
  try{
    const first=model.embed(['1']),firstResult=first.catch(error=>error);t.mock.timers.tick(0);
    const old=workers[0],lateError=old.onerror;
    if(reason==='timeout'){t.mock.timers.tick(50);assert.match((await firstResult).message,/timed out/);}
    else{old.answer();await first;t.mock.timers.tick(0);if(reason==='idle')t.mock.timers.tick(10);else model.release();}
    assert.equal(old.terminated,true);
    const second=model.embed(['2'],{priority:'query'}),outcome=second.catch(error=>error);t.mock.timers.tick(0);
    const replacement=workers[1];lateError();
    assert.ok(!replacement.terminated,'a retired worker must not terminate the current worker');
    replacement.answer();assert.equal((await outcome)[0][0],2);
  }finally{model.release();}
});

for(const event of ['onerror','onmessageerror'])test(`${event} settles active and queued callers promptly and permits a fresh retry`,async t=>{
  const {workers,model}=fixture(t);
  try{
    const first=model.embed(['1']),second=model.embed(['2'],{priority:'query'});
    const settled=Promise.allSettled([first,second]);t.mock.timers.tick(0);
    if(event==='onerror')workers[0].onerror();else workers[0].dispatchEvent(new Event('messageerror'));
    assert.equal(workers[0].terminated,true,'error handling must settle immediately, before the timeout');
    const results=await settled;assert.ok(results.every(result=>result.status==='rejected'));assert.equal(workers[0].terminated,true);
    const retry=model.embed(['3']);t.mock.timers.tick(0);workers[1].answer();assert.equal((await retry)[0][0],3);
  }finally{model.release();}
});
