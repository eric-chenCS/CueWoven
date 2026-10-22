import {EMBEDDING_VERSION,embeddingText} from './embedding-migration.js';

// Bump this marker when inference batching or preprocessing changes.
export const TRANSCRIPT_BATCH = EMBEDDING_VERSION + ':batch4-v1';

// q8 output depends on batch composition; reuse only a complete, proven-identical input sequence.
export async function embedTranscript(video,chunks,previous,rows,embed) {
  const texts=chunks.map(row=>embeddingText(video,row.text));
  const reusable=previous?.transcriptBatch===TRANSCRIPT_BATCH && !previous.partial && !['history-title','speech-local'].includes(previous.method)
    && rows.length===chunks.length && rows.every((row,i)=>row.embeddingVersion===EMBEDDING_VERSION
      && row.vec instanceof Int8Array && row.vec.length===384 && Number.isFinite(row.scale) && row.scale>0
      && embeddingText(previous,row.text)===texts[i]);
  if(reusable)return chunks.map((row,i)=>({...row,vec:rows[i].vec,scale:rows[i].scale,embeddingVersion:EMBEDDING_VERSION}));
  const vectors=await embed(texts);
  return chunks.map((row,i)=>({...row,vec:vectors[i],embeddingVersion:EMBEDDING_VERSION}));
}
