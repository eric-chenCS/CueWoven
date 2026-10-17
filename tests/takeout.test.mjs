import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseTakeoutHistory, validateHistoryBatch, validateTakeoutFileSize, MAX_TAKEOUT_BYTES} from '../lib/takeout.js';

const row = (overrides={}) => ({header:'YouTube',title:'Watched Why batteries wear out',titleUrl:'https://www.youtube.com/watch?v=aaaaaaaaaaa',
  time:'2024-01-02T03:04:05Z',subtitles:[{name:'Science channel',url:'https://www.youtube.com/channel/example'}],...overrides});

test('Takeout extracts only video metadata and keeps the latest duplicate watch',()=>{
  const out=parseTakeoutHistory([row(),row({time:'2025-01-02T03:04:05Z',title:'Watched Updated title',locationInfo:'private'}),row({titleUrl:'https://youtu.be/bbbbbbbbbbb'})]);
  assert.deepEqual(out[0],{videoId:'aaaaaaaaaaa',title:'Updated title',channel:'Science channel',watchedAt:Date.parse('2025-01-02T03:04:05Z')});
  assert.equal(out.length,2);
  assert.ok(out.every(v=>Object.keys(v).sort().join(',')==='channel,title,videoId,watchedAt'));
});

test('Takeout rejects non-history shapes and ignores invalid or non-video activity',()=>{
  assert.throws(()=>parseTakeoutHistory({videos:[]}),/watch-history.json/);
  assert.throws(()=>parseTakeoutHistory([]),/No usable/);
  assert.equal(parseTakeoutHistory([...Array(100001).fill(null),row()]).length,1);
  const out=parseTakeoutHistory([null,row({time:'invalid'}),row({titleUrl:'https://evil.example/watch?v=aaaaaaaaaaa'}),row({titleUrl:'https://www.youtube.com/results?search_query=private'}),row({titleUrl:'aaaaaaaaaaa'}),row({title:' '}),row()]);
  assert.equal(out.length,1);
});

test('Takeout accepts up to 100 MB without asking users to split JSON',()=>{
  assert.equal(MAX_TAKEOUT_BYTES,100*1024*1024);
  assert.doesNotThrow(()=>validateTakeoutFileSize(MAX_TAKEOUT_BYTES));
  assert.throws(()=>validateTakeoutFileSize(MAX_TAKEOUT_BYTES+1),/100 MB/);
});

test('Takeout accepts non-English titles and caps external text',()=>{
  assert.equal(parseTakeoutHistory([row({title:'視聴済み 宇宙について'})])[0].title,'視聴済み 宇宙について');
  assert.equal(parseTakeoutHistory([row({title:'x'.repeat(500)})])[0].title.length,300);
});

test('history import validates the full message batch before writing',()=>{
  const good=parseTakeoutHistory([row()])[0];
  assert.equal(validateHistoryBatch([good])[0].videoId,'aaaaaaaaaaa');
  for(const value of [null,[],Array(33).fill(good),[{...good,videoId:'bad'}],[{...good,watchedAt:NaN}],[good,{...good,title:''}]]) {
    assert.throws(()=>validateHistoryBatch(value));
  }
});
