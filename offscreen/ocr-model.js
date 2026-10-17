import {recognizedScreenLines,cleanScreenText,cleanScreenLines} from '../lib/screen-text.js';

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
  function release(){
    generation++;clearTimeout(idle);model?.worker.terminate();model=null;
    active?.reject(Error('On-screen text processing stopped.'));active=null;onState({status:'idle'});
  }
  async function read(image,width,height){
    if(active)return {busy:true};
    clearTimeout(idle);const epoch=generation;let reject;
    const canceled=new Promise((_,fail)=>{reject=fail}),job={reject};active=job;
    const timer=setTimeout(()=>{if(active===job)release();},timeoutMs);
    const work=async()=>{
      if(!model){
        onState({status:'loading'});const loaded=await load();
        if(epoch!==generation){loaded.worker.terminate();throw Error('On-screen text processing stopped.');}
        model=loaded;
      }
      onState({status:'working'});
      const {worker,PSM}=model;
      await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK});
      const top=Math.floor(height*.55);
      const bottom=await worker.recognize(image,{rectangle:{left:0,top,width,height:height-top}},{text:true,blocks:true});
      if(epoch!==generation)throw Error('On-screen text processing stopped.');
      await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT});
      const full=await worker.recognize(image,{},{text:true,blocks:true});
      const bottomLines=recognizedScreenLines(bottom.data),subtitle=cleanScreenText(bottomLines.join(' '));
      // Sparse layout can split a subtitle into fragments; do not append duplicates.
      const extra=recognizedScreenLines(full.data).filter(line=>!subtitle.toLowerCase().includes(line.toLowerCase()));
      const lines=cleanScreenLines([...bottomLines,...extra]);
      return {text:cleanScreenText(lines.join(' ')),lines};
    };
    try{const result=await Promise.race([work(),canceled]);if(epoch!==generation)throw Error('On-screen text processing stopped.');onState({status:'ready'});return result;}
    catch(error){if(epoch===generation){model?.worker.terminate();model=null;onState({status:'error',error:error.message});}throw error;}
    finally{clearTimeout(timer);if(active===job){active=null;idle=setTimeout(release,idleMs);}}
  }
  return {read,release};
}
