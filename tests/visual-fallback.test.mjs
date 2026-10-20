import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fuseMatches} from '../lib/scenes.js';
const word=(videoId,score,extra={})=>({videoId,start:42,score,text:'Relevant saved evidence',match:'related',...extra});
const scene=(videoId,score=.8,extra={})=>({videoId,start:40,score,scene:true,key:videoId+':2',...extra});

test('scenes cannot boost a lower text result or introduce unrelated results when text is relevant',()=>{
  const words=[word('best-text',.8),word('second-text',.6)];
  const results=fuseMatches(words,[scene('second-text'),scene('unrelated')],{perVideo:1});
  assert.deepEqual(results.map(row=>row.videoId),['best-text','second-text']);
  assert.ok(results.every(row=>!row.scene&&!row.key&&!row.sceneStart));
});

test('speech, OCR, page passages and titles retain priority over image similarity',()=>{
  for(const extra of [{speechGenerated:true},{screenText:true},{pageText:true,matchSources:['Page text']},{titleOnly:true}]){
    const result=fuseMatches([word('spoken',.6,extra)],[scene('unrelated',.99)]);
    assert.equal(result.length,1);assert.equal(result[0].videoId,'spoken');assert.equal(result[0].start,42);
  }
});

test('close text evidence stays primary even with a lower semantic score',()=>{
  const result=fuseMatches([word('exact-quote',.22,{match:'close'})],[scene('unrelated',.99)]);
  assert.deepEqual(result.map(row=>row.videoId),['exact-quote']);
});

test('scenes and article screenshots remain available when text has only weak related matches',()=>{
  const result=fuseMatches([word('incidental',.2)],[scene('cats',.28),scene('diagram',.27,{articleImage:true})]);
  assert.deepEqual(result.map(row=>row.videoId),['cats','diagram']);
  assert.deepEqual(result.map(row=>row.matchSources),[['Scene'],['Article image']]);
});

test('weak text is retained when no eligible visual fallback exists',()=>{
  const words=[word('related',.2)];
  for(const images of [[],[scene('noise',.23)],[scene('invalid',NaN)]])assert.equal(fuseMatches(words,images)[0].videoId,'related');
});

test('text pagination cannot switch to unrelated scenes after the last text page',()=>{
  const words=Array.from({length:25},(_,i)=>word('text'+i,.7));
  const images=Array.from({length:25},(_,i)=>scene('image'+i));
  for(const offset of [0,12,24,25,36]){
    assert.deepEqual(fuseMatches(words,images,{offset,limit:12,perVideo:1}).map(row=>row.videoId),words.slice(offset,offset+12).map(row=>row.videoId));
  }
});

test('visual fallback preserves per-video limits and stable pagination',()=>{
  const images=[scene('cat',.5),scene('cat',.4,{start:80,key:'cat:4'}),scene('dog',.3)];
  assert.deepEqual(fuseMatches([],images,{perVideo:1}).map(row=>row.videoId),['cat','dog']);
  assert.equal(fuseMatches([],images,{perVideo:1,offset:1,limit:1})[0].videoId,'dog');
});
