// Queries pass background work at each four-text inference boundary.
export function createTextModel(onState=()=>{},{WorkerClass=globalThis.Worker,idleMs=300000,timeoutMs=180000}={}){
  let worker=null,running=null,nextId=0,idle,deadline,scheduled=false;
  const queries=[],background=[];
  function release(error=new Error('Text processing stopped.')){
    clearTimeout(idle);clearTimeout(deadline);worker?.terminate();worker=null;
    running?.job.reject(error);running=null;
    for(const job of [...queries.splice(0),...background.splice(0)])job.reject(error);
    onState({status:'idle',progress:0});
  }
  function schedule(){if(!scheduled){scheduled=true;setTimeout(()=>{scheduled=false;drain();},0);}}
  function drain(){
    if(running)return;
    const job=queries.shift()||background.shift();
    if(!job){if(worker)idle=setTimeout(release,idleMs);return;}
    clearTimeout(idle);
    try{
      if(!worker){
        onState({status:'loading',progress:0});
        worker=new WorkerClass(new URL('text-worker.js',import.meta.url),{type:'module'});
        worker.onmessage=({data})=>{
          if(!running||data.id!==running.id)return;
          if('progress'in data){onState({status:'loading',progress:data.progress});return;}
          clearTimeout(deadline);
          const {job,count}=running;running=null;
          if(data.error){job.reject(new Error(data.error));release(new Error(data.error));return;}
          job.vectors.push(...data.vectors);job.offset+=count;
          onState({status:'ready',progress:1});
          if(job.offset<job.texts.length)(job.priority==='query'?queries:background).push(job);
          else job.resolve(job.vectors);
          schedule();
        };
        worker.onerror=()=>release(new Error('The search model worker failed. Retry to reload it.'));
      }
      const texts=job.texts.slice(job.offset,job.offset+4),id=++nextId;
      running={job,id,count:texts.length};
      deadline=setTimeout(()=>release(new Error('The search model timed out. Retry to reload it.')),timeoutMs);
      worker.postMessage({id,texts});
    }catch(error){running=null;job.reject(error);release(error);}
  }
  function embed(texts,{priority='background'}={}){
    return new Promise((resolve,reject)=>{
      (priority==='query'?queries:background).push({texts,priority,resolve,reject,vectors:[],offset:0});
      clearTimeout(idle);schedule();
    });
  }
  return {embed,warmup:()=>embed([],{priority:'query'}),release};
}
