export async function withTimeout(request,ms=10000){
  let timer;
  try{return await Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Search is taking longer than expected. Retry when indexing has caught up.')),ms);})]);}
  finally{clearTimeout(timer);}
}
