import {test} from 'node:test';
import assert from 'node:assert/strict';
import {historyVideos} from '../lib/history.js';

const parse = url => /^https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})$/.exec(url)?.[1] || null;
const visit = (id,time,title) => ({url:`https://www.youtube.com/watch?v=${id}`,lastVisitTime:time,title});

test('history keeps the newest visit, sorts, caps and removes non-video fields',()=>{
  assert.deepEqual(historyVideos([
    visit('aaaaaaaaaaa',10,'Older - YouTube'),
    visit('bbbbbbbbbbb',20,'Second - YouTube'),
    {...visit('aaaaaaaaaaa',30,'Newest - YouTube'),sensitive:'not returned'},
  ],parse,1),[{videoId:'aaaaaaaaaaa',lastVisitTime:30,title:'Newest'}]);
});

test('history ignores malformed records, non-YouTube URLs and invalid visit times',()=>{
  assert.deepEqual(historyVideos([null,{}, {url:'javascript:alert(1)',lastVisitTime:1},
    visit('aaaaaaaaaaa',NaN,'bad'),visit('bbbbbbbbbbb',-1,'bad'),
  ],parse),[]);
});

test('history limits long titles and uses the video ID for missing titles',()=>{
  const rows=historyVideos([visit('aaaaaaaaaaa',1,'x'.repeat(1000)),visit('bbbbbbbbbbb',2,'')],parse);
  assert.equal(rows[0].title,'bbbbbbbbbbb');
  assert.equal(rows[1].title.length,300);
});
