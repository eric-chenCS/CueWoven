import {recognizedScreenLines,cleanScreenText,mergeScreenLines} from '../lib/screen-text.js';

// One worker, no frame queue. Idle workers release their WASM memory.
export function createOcrModel(onState=()=>{},load=async()=>{
  const {createWorker,PSM}=await import('../vendor/ocr/ocr.bundle.js');
  const worker=await createWorker('eng',1,{
    workerPath:chrome.runtime.getURL('vendor/ocr/worker.min.js'),
    corePath:chrome.runtime.getURL('vendor/ocr/'),langPath:chrome.runtime.getURL('vendor/ocr'),
    workerBlobURL:false,cacheMethod:'none',
  });
  return {worker,PSM};
},{timeoutMs=20000,idleMs=60000}={}) {
  let model=null,generation=0,active=null,idle;
  function terminate(worker){
    if(!worker?.terminate)return;
    try{Promise.resolve(worker.terminate()).catch(()=>{});}catch{}
  }
  function release(){
    generation++;clearTimeout(idle);const worker=model?.worker;model=null;terminate(worker);
    active?.reject(Error('On-screen text processing stopped.'));active=null;onState({status:'idle'});
  }
  async function read(image,width,height){
    if(active)return {busy:true};
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||width>1280||height>720)throw Error('Invalid screenshot dimensions.');
    clearTimeout(idle);const epoch=generation;let reject;
    const canceled=new Promise((_,fail)=>{reject=fail}),job={reject};active=job;
    const timer=setTimeout(()=>{if(active===job)release();},timeoutMs);
    const work=async()=>{
      if(!model){
        onState({status:'loading'});const loaded=await load();
        if(epoch!==generation){terminate(loaded?.worker);throw Error('On-screen text processing stopped.');}
        model=loaded;
      }
      onState({status:'working'});
      const {worker,PSM}=model;
      await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK});
      if(epoch!==generation)throw Error('On-screen text processing stopped.');
      const top=Math.floor(height*.55);
      const bottom=await worker.recognize(image,{rectangle:{left:0,top,width,height:height-top}},{text:true,blocks:true});
      if(epoch!==generation)throw Error('On-screen text processing stopped.');
      // Automatic layout finds boxed overlays that sparse segmentation can skip.
      await worker.setParameters({tessedit_pageseg_mode:PSM.AUTO});
      if(epoch!==generation)throw Error('On-screen text processing stopped.');
      const full=await worker.recognize(image,{},{text:true,blocks:true});
      if(epoch!==generation)throw Error('On-screen text processing stopped.');
      const lines=mergeScreenLines([...recognizedScreenLines(bottom.data),...recognizedScreenLines(full.data)]);
      return {text:cleanScreenText(lines.join(' ')),lines};
    };
    try{const result=await Promise.race([work(),canceled]);if(epoch!==generation)throw Error('On-screen text processing stopped.');onState({status:'ready'});return result;}
    catch(error){if(epoch===generation){const worker=model?.worker;model=null;terminate(worker);onState({status:'error',error:error?.message||String(error)});}throw error;}
    finally{clearTimeout(timer);if(active===job){active=null;idle=setTimeout(release,idleMs);}}
  }
  return {read,release};
}
