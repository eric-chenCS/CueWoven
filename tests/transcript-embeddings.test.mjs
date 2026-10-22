import {test} from 'node:test';
import assert from 'node:assert/strict';
import {embedTranscript,TRANSCRIPT_BATCH} from '../lib/transcript-embeddings.js';
import {EMBEDDING_VERSION} from '../lib/embedding-migration.js';
const video={method:'captions',title:'Original title',channel:'Original channel',transcriptBatch:TRANSCRIPT_BATCH};
const saved=(text,extra={})=>({text,start:0,end:8,vec:new Int8Array(384).fill(2),scale:.01,embeddingVersion:EMBEDDING_VERSION,...extra});
const fresh=texts=>Promise.resolve(texts.map(()=>new Float32Array(384).fill(.05)));

test('complete unchanged transcript reuses packed vectors while retaining moved timestamps and duplicate moments',async()=>{
 const old=[saved('Getting older with a bad back'),saved('Getting older with a bad back')];
 const chunks=[{text:old[0].text,start:42,end:53},{text:old[1].text,start:200,end:211}];
 const result=await embedTranscript({...video,title:'New title'},chunks,video,old,()=>{throw Error('Unexpected inference')});
 assert.equal(result.length,2);assert.deepEqual(result.map(({start,end})=>({start,end})),chunks.map(({start,end})=>({start,end})));
 for(let i=0;i<2;i++){assert.equal(result[i].vec,old[i].vec);assert.equal(result[i].scale,old[i].scale);assert.equal(result[i].embeddingVersion,EMBEDDING_VERSION);assert.equal(result[i].id,undefined);}
});

test('changed, added, removed and reordered input always use the original complete inference batch',async()=>{
 const old=[saved('First passage'),saved('Second passage')];
 for(const texts of [['First passage','Changed passage'],['First passage'],['First passage','Second passage','Third passage'],['Second passage','First passage']]){
  let call;const result=await embedTranscript(video,texts.map(text=>({text})),video,old,async input=>{call=input;return fresh(input)});
  assert.deepEqual(call,texts);assert.equal(result.length,texts.length);assert.ok(result.every(row=>row.vec instanceof Float32Array));
 }
});

test('legacy, malformed, unmarked, history and partial vectors are recomputed',async()=>{
 const cases=[{previous:video,row:saved('words',{embeddingVersion:'old'})},{previous:video,row:saved('words',{vec:new Int8Array(12)})},{previous:video,row:saved('words',{scale:NaN})},{previous:video,row:saved('words',{scale:0})},{previous:video,row:saved('words',{vec:new Float32Array(384)})},...[
  {...video,transcriptBatch:undefined},{...video,transcriptBatch:'different-version'},{...video,method:'history-title'},{...video,method:'speech-local'},{...video,partial:true},null
 ].map(previous=>({previous,row:saved('words')}))];
 for(const {previous,row} of cases){let calls=0;await embedTranscript(video,[{text:'words'}],previous,[row],async texts=>{calls++;return fresh(texts)});assert.equal(calls,1);}
});

test('contextual history titles keep their title and channel model input',async()=>{
 const history={...video,method:'history-title'};let call;
 await embedTranscript({...history,channel:'Different channel'},[{text:'Original title'}],history,[saved('Original title')],async texts=>{call=texts;return fresh(texts)});
 assert.deepEqual(call,['Original title. Different channel']);
});

test('duplicate new passages retain the original inference batch and failures propagate',async()=>{
 let calls;await embedTranscript(video,[{text:'words'},{text:'words'}],null,[],async texts=>{calls=texts;return fresh(texts)});assert.deepEqual(calls,['words','words']);
 await assert.rejects(embedTranscript(video,[{text:'words'}],null,[],async()=>{throw Error('Model unavailable')}),/Model unavailable/);
});
