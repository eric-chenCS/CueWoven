import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEmbeddingMigration,embeddingText,EMBEDDING_VERSION} from '../lib/embedding-migration.js';
import {createRevisionCache} from '../lib/revision-cache.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('passages and audio embed only their words, while imported titles retain channel context',()=>{
  assert.equal(embeddingText({title:'Unrelated title',method:'captions'},'actual passage'),'actual passage');
  assert.equal(embeddingText({title:'Unrelated title',method:'speech-local'},'heard words'),'heard words');
  assert.equal(embeddingText({title:'History title',channel:'Channel',method:'history-title'},'title'),'History title. Channel');
});
test('migration is coalesced, batched and skips current vectors and orphan chunks',async()=>{
  const batches=[],states=[];let release;
  const migration=createEmbeddingMigration({embed:async texts=>{batches.push(texts);if(!release)await new Promise(resolve=>release=resolve);return texts.map(()=>new Float32Array(384))},write:async batch=>batch.length,onChange:state=>states.push(state),yieldWork:async()=>{}});
  const videos=[{videoId:'a',title:'Metadata',method:'captions'}],chunks=Array.from({length:35},(_,id)=>({id,videoId:'a',text:'passage '+id}));
  chunks.push({id:100,videoId:'a',text:'current',embeddingVersion:EMBEDDING_VERSION},{id:101,videoId:'orphan',text:'ignored'});
  const first=migration.start(videos,chunks),second=migration.start(videos,chunks);assert.equal(first,second);assert.equal(migration.status().status,'running');
  release();await first;assert.deepEqual(batches.map(batch=>batch.length),[16,16,3]);assert.equal(migration.status().updated,35);assert.equal(migration.status().status,'ready');
  assert.ok(states.every(state=>state.done<=state.total));
});
test('migration failure leaves a recoverable error and can retry',async()=>{
  let failed=true;const migration=createEmbeddingMigration({embed:async()=>{if(failed)throw Error('offline');return [[1]]},write:async()=>1,yieldWork:async()=>{}});
  const videos=[{videoId:'a'}],chunks=[{id:1,videoId:'a',text:'saved'}];
  await assert.rejects(migration.start(videos,chunks),/offline/);assert.equal(migration.status().status,'error');failed=false;
  await migration.start(videos,chunks);assert.equal(migration.status().status,'ready');assert.equal(migration.status().updated,1);
});
test('an in-flight index build cannot undo invalidation and concurrent reads coalesce',async()=>{
  const releases=[];let reads=0;const cache=createRevisionCache(()=>new Promise(resolve=>{reads++;releases.push(resolve)}));
  const first=cache.get(),second=cache.get();await tick();assert.equal(reads,1);cache.invalidate();releases.shift()({old:true});await tick();
  assert.equal(reads,2);releases.shift()({current:true});assert.deepEqual(await first,{current:true});assert.equal(await first,await second);assert.equal(reads,2);
});
test('a failed index read does not poison later reads',async()=>{
  let fail=true;const cache=createRevisionCache(async()=>{if(fail)throw Error('read failed');return {current:true}});
  await assert.rejects(cache.get(),/read failed/);fail=false;assert.deepEqual(await cache.get(),{current:true});
});
