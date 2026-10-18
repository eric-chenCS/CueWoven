import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shouldForgetVideo} from '../lib/retention.js';
const now=Date.now();const old=now-60*864e5;
test('import retention is opt-in and uses the original visit rather than fetch date',()=>{const imported={historyImported:true,method:'captions',watchedAt:now-100*864e5,indexedAt:now};assert.equal(shouldForgetVideo(imported,0,now,90),true);assert.equal(shouldForgetVideo({...imported,watchedAt:now-89*864e5},0,now,90),false);assert.equal(shouldForgetVideo(imported,30,now,0),false);assert.equal(shouldForgetVideo(imported,0,now,365),false);assert.equal(shouldForgetVideo({...imported,watchedAt:undefined},30,now,90),false);});
test('title-only imported history survives the transcript retention setting',()=>{
  assert.equal(shouldForgetVideo({method:'history-title',indexedAt:old,watchedAt:old},30,now),false);
});
test('transcripts expire by latest watch or indexing activity, and Never preserves them',()=>{
  assert.equal(shouldForgetVideo({method:'captions',indexedAt:old},30,now),true);
  assert.equal(shouldForgetVideo({method:'captions',indexedAt:old,watchedAt:now},30,now),false);
  assert.equal(shouldForgetVideo({method:'captions',indexedAt:now,watchedAt:old},30,now),false);
  assert.equal(shouldForgetVideo({method:'captions',indexedAt:old},0,now),false);
});

test('watched scene-only entries expire while explicitly imported titles survive',()=>{
 for(const video of [{method:'history-title',historyImported:false},{method:'history-title',sceneCount:1}])assert.equal(shouldForgetVideo({...video,indexedAt:old,watchedAt:old},30,now),true);
 assert.equal(shouldForgetVideo({method:'history-title',historyImported:true,sceneCount:1,indexedAt:old},30,now),false);
 assert.equal(shouldForgetVideo({method:'history-title',historyImported:false,indexedAt:old,watchedAt:now},30,now),false);
});

test('background-fetched imported transcripts retain their exemption at 31 days',()=>{
 const fetched=now-31*864e5;
 for(const method of ['captions','speech-local','import'])assert.equal(shouldForgetVideo({method,historyImported:true,indexedAt:fetched,watchedAt:old},30,now),false);
 assert.equal(shouldForgetVideo({method:'captions',historyImported:false,indexedAt:fetched,watchedAt:old},30,now),true);
});

for (const days of [1,7,28,365]) test(`both retention policies respect ${days} days at the cutoff`,()=>{
 for(const historyImported of [false,true]){
  const entry={historyImported,method:'captions',indexedAt:now-(days*864e5)-1,watchedAt:now-(days*864e5)-1};
  assert.equal(shouldForgetVideo(entry,days,now,days),true);
  assert.equal(shouldForgetVideo({...entry,indexedAt:now-days*864e5,watchedAt:now-days*864e5},days,now,days),false);
  assert.equal(shouldForgetVideo(entry,0,now,0),false);
 }
});
