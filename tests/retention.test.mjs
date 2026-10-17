import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shouldForgetVideo} from '../lib/retention.js';
const now=Date.now();const old=now-60*864e5;
test('title-only imported history survives the transcript retention setting',()=>{
  assert.equal(shouldForgetVideo({method:'history-title',indexedAt:old,watchedAt:old},30,now),false);
});
test('transcripts expire by latest watch or indexing activity, and Never preserves them',()=>{
  assert.equal(shouldForgetVideo({method:'captions',indexedAt:old},30,now),true);
  assert.equal(shouldForgetVideo({method:'captions',indexedAt:old,watchedAt:now},30,now),false);
  assert.equal(shouldForgetVideo({method:'captions',indexedAt:now,watchedAt:old},30,now),false);
  assert.equal(shouldForgetVideo({method:'captions',indexedAt:old},0,now),false);
});
