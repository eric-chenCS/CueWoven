const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const f=await fixture(),report={errors:[]};f.context.on('weberror',event=>report.errors.push(event.error().message));
 try{
  report.browser=await f.context.browser().version();
  report.result=await f.options.evaluate(async()=>{
   const {createTextModel}=await import(chrome.runtime.getURL('offscreen/text-model.js')),workers=[];
   let retired,late=false,unreadable=false;
   class RecordingWorker extends Worker{
    constructor(...args){super(...args);workers.push(this);}
    postMessage(...args){
     super.postMessage(...args);
     if(late){late=false;retired.dispatchEvent(new ErrorEvent('error',{message:'Controlled late event from retired worker'}));}
     if(unreadable){unreadable=false;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('messageerror')));}
    }
   }
   const model=createTextModel(()=>{},{WorkerClass:RecordingWorker});
   const texts=['The speaker admits that aging is not fun and his back hurts.','Coral loses its algae when warm ocean water causes heat stress.'];
   const equal=(before,after)=>before.length===after.length&&before.every((vec,i)=>vec.length===384&&vec.every((n,j)=>n===after[i][j]));
   try{
    const before=await model.embed(texts);retired=workers[0];model.release();late=true;
    const pending=model.embed(texts,{priority:'query'});
    const after=await pending;if(!equal(before,after))throw Error('Retired-worker error changed or interrupted inference');
    unreadable=true;const start=performance.now();
    const first=model.embed(texts),queued=model.embed(texts,{priority:'query'}),results=Promise.allSettled([first,queued]);
    const stopped=await results,errorMs=performance.now()-start;
    if(!stopped.every(row=>row.status==='rejected'))throw Error('Unreadable response left inference active: '+JSON.stringify({statuses:stopped.map(row=>row.status),handler:typeof workers.at(-1).onmessageerror,nativeSetter:!!Object.getOwnPropertyDescriptor(Worker.prototype,'onmessageerror')?.set,workers:workers.length}));
    const retried=await model.embed(texts);if(!equal(before,retried))throw Error('Reload changed inference vectors');
    return {workers:workers.length,vectors:before.length,dimensions:before[0].length,bitIdenticalAfterReload:true,allPendingRejected:true,errorMs,controlledEvents:true};
   }finally{model.release();}
  });
  assert.equal(report.result.workers,3);assert.deepEqual(report.errors,[]);report.pass=true;
  if(process.env.RECALL_REPORT_DIR){fs.mkdirSync(process.env.RECALL_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR,'text-worker-recovery.json'),JSON.stringify(report,null,2));}
  console.log('TEXT_WORKER_RECOVERY_PASS',JSON.stringify(report));
 }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
