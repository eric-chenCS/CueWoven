// Keep each background request to one video or image, with durable progress.
export async function restoreBackup(data,send,onProgress=()=>{},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))) {
  if(!data || data.format!=='recall-export' || !Array.isArray(data.videos))throw Error('Not a Recall export file');
  const scenes=Array.isArray(data.scenes)?data.scenes.slice(-2000):[];
  const screenText=Array.isArray(data.screenText)?data.screenText.slice(-10000):[];
  const total=data.videos.length+scenes.length+screenText.length;let done=0,imported=0;
  async function request(part){
    let response;
    const delays=[500,1000,2000,3000];
    for(let attempt=0;;attempt++){
      try{response=await send({type:'import',data:{format:'recall-export',...part}});}catch(error){response={error:error.message};}
      // This preflight rejection happens before writes; other errors must not replay.
      if(/^Wait for scene processing to finish\b/.test(response?.error||'') && attempt<delays.length){await wait(delays[attempt]);continue;}
      break;
    }
    if(!response || response.error || !Number.isSafeInteger(response.imported))throw Error(`Restore stopped after ${done}/${total} items: ${response?.error || 'No valid response'}. Completed items remain saved.`);
    return response;
  }
  for(const video of data.videos){
    const response=await request({videos:[video]});
    imported+=response.imported;onProgress({done:++done,total,imported});
  }
  for(const scene of scenes){
    await request({videos:[],scenes:[scene]});
    onProgress({done:++done,total,imported});
  }
  for(let i=0;i<screenText.length;i+=16){
    const batch=screenText.slice(i,i+16);await request({videos:[],screenText:batch});done+=batch.length;onProgress({done,total,imported});
  }
  return {imported};
}
