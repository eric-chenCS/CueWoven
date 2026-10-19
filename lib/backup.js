// Keep each background request to one video or image, with durable progress.
import {SCENE_STORAGE_CHOICES,sceneCaps} from './scenes.js';
export async function restoreBackup(data,send,onProgress=()=>{}) {
  if(!data || data.format!=='recall-export' || !Array.isArray(data.videos))throw Error('Not a CueWoven export file');
  // Read up to the largest choice; the engine then keeps what fits the chosen size.
  const scenes=Array.isArray(data.scenes)?data.scenes.slice(-sceneCaps(Math.max(...SCENE_STORAGE_CHOICES)).count):[];
  const screenText=Array.isArray(data.screenText)?data.screenText.slice(-10000):[];
  if(data.items!==undefined&&!Array.isArray(data.items))throw Error('Invalid web-history backup.');
  const items=data.items||[];
  const total=data.videos.length+items.length+scenes.length+screenText.length;let done=0,imported=0;
  async function request(part){
    let response;
    try{response=await send({type:'import',data:{format:'recall-export',...part}});}catch(error){response={error:error.message};}
    if(!response || response.error || !Number.isSafeInteger(response.imported))throw Error(`Restore stopped after ${done}/${total} items: ${response?.error || 'No valid response'}. Completed items remain saved.`);
    return response;
  }
  for(const video of data.videos){
    const response=await request({videos:[video]});
    imported+=response.imported;onProgress({done:++done,total,imported});
  }
  for(const item of items){
    const response=await request({videos:[],items:[item]});imported+=response.imported;onProgress({done:++done,total,imported});
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
