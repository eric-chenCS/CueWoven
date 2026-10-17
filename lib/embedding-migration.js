export const EMBEDDING_VERSION = 'minilm-l6-v2-body-v2';
export const embeddingText = (video,text) => video.method === 'history-title' ? `${video.title || ''}. ${video.channel || ''}`.trim() : text;

// Upgrade vectors in small background batches; never rewrite transcript records.
export function createEmbeddingMigration({embed,write,onChange=()=>{},yieldWork=()=>new Promise(resolve=>setTimeout(resolve,0))}) {
  let pending=null,state={status:'idle',done:0,total:0};
  const status=()=>({...state}),publish=()=>onChange(status());
  return {
    status,
    start(videos,chunks) {
      if(pending)return pending;
      const records=new Map(videos.map(video=>[video.videoId,video]));
      const stale=chunks.filter(chunk=>records.has(chunk.videoId)&&chunk.embeddingVersion!==EMBEDDING_VERSION);
      if(!stale.length)return Promise.resolve(status());
      state={status:'running',done:0,total:stale.length,updated:0};publish();
      pending=(async()=>{
        for(let i=0;i<stale.length;i+=16){
          const batch=stale.slice(i,i+16),vectors=await embed(batch.map(chunk=>embeddingText(records.get(chunk.videoId),chunk.text)));
          const updated=await write(batch,vectors,EMBEDDING_VERSION);
          state.done+=batch.length;state.updated+=updated;publish();await yieldWork();
        }
        state.status='ready';publish();return status();
      })().catch(error=>{state.status='error';state.error=String(error.message||error);publish();throw error;}).finally(()=>{pending=null});
      return pending;
    },
  };
}
