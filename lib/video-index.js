import {quantize} from './web-items.js';
import {phraseText} from './search.js';
export const TEXT_INDEX_ROWS=100000, TEXT_INDEX_VIDEOS=1000;
export function packIndex(rows,dim=384){
  const matrix=new Int8Array(rows.length*dim),scales=new Float32Array(rows.length);
  const meta=rows.map((row,i)=>{
    const packed=row.vec instanceof Int8Array?row:quantize(row.vec);
    matrix.set(packed.vec,i*dim);scales[i]=packed.scale;
    return {videoId:row.videoId,start:row.start,text:row.text,kind:row.kind,lexicalText:row.lexicalText??phraseText(row.text)};
  });
  return {matrix,scales,dim,meta};
}
export async function loadVideoChunks(db,videos,{maxRows=TEXT_INDEX_ROWS,maxVideos=TEXT_INDEX_VIDEOS}={}){
  const recent=new Set([...videos.values()].filter(video=>video.method!=='history-title').sort((a,b)=>(b.watchedAt||b.indexedAt||0)-(a.watchedAt||a.indexedAt||0)).slice(0,maxVideos).map(video=>video.videoId));
  const chunks=[],indexedIds=new Set();let overflow=false;
  await db.scanChunks(rows=>{
    for(const row of rows){
      const video=videos.get(row.videoId);
      if(!video||row.vec?.length!==384)continue;
      if(chunks.length<maxRows&&(video.method==='history-title'||recent.has(row.videoId))){chunks.push(row);indexedIds.add(row.id);}
      else overflow=true;
    }
  });
  return {chunks,indexedIds,overflow};
}
