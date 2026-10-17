import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rank,queryTerms} from '../lib/search.js';
import {fuseMatches} from '../lib/scenes.js';
const vector=score=>new Float32Array([score,Math.sqrt(1-score*score)]);
function search(rows,query,options={}) {
  const matrix=new Float32Array(rows.flatMap(row=>Array.from(vector(row.similarity))));
  const videos=new Map(rows.map(row=>[row.videoId,{title:row.title||'',channel:row.channel||'',method:row.method||'captions',watchedAt:100}]));
  return rank(new Float32Array([1,0]),{matrix,dim:2,meta:rows},videos,{query,perVideo:1,...options});
}
test('a weak literal decoy cannot beat a strong semantic paraphrase',()=>{
  const out=search([{videoId:'real',start:42,text:'Active lithium gets trapped and energy storage fades.',similarity:.85},{videoId:'decoy',start:7,text:'Rechargeable lunch box recipes.',similarity:.2}],'why do rechargeable batteries lose capacity');
  assert.equal(out[0].videoId,'real');
});
test('quoted remembered speech can be found even when its semantic score is poor',()=>{
  const out=search([{videoId:'literal',start:72,text:'Put it right there. The trap is ready.',similarity:.05},{videoId:'paraphrase',start:5,text:'Position the object in that location.',similarity:.8}],'"put it right there"');
  assert.equal(out[0].videoId,'literal');assert.equal(out[0].start,72);
});
test('token matching never mistakes carbon for car',()=>{
  const out=search([{videoId:'carbon',start:20,text:'Carbon capture.',similarity:.3},{videoId:'car',start:40,text:'Wash the car.',similarity:.3}],'car');
  assert.equal(out[0].videoId,'car');
});
test('title matches remain eligible above weak unrelated transcripts',()=>{
  const out=search([{videoId:'history',start:0,title:'Roman concrete under seawater',text:'Roman concrete under seawater',method:'history-title',similarity:.9},{videoId:'unrelated',start:80,text:'We jumped into the water.',similarity:.2}],'Roman concrete under seawater');
  assert.equal(out[0].videoId,'history');assert.equal(out[0].titleOnly,true);
});
test('metadata alone cannot rescue a semantically unrelated passage',()=>{
  const out=search([{videoId:'misleading',start:20,title:'Battery chemistry charge cycles',channel:'Battery',text:'A sandwich recipe.',similarity:.01}],'battery chemistry');
  assert.equal(out.length,0);
});
test('accent folding and Unicode terms work without dropping saved titles',()=>{
  assert.deepEqual(queryTerms('Café Lumière'),['cafe','lumiere']);assert.deepEqual(queryTerms('京都の寺'),['京都の寺']);
  assert.deepEqual(queryTerms('lithium-ion 京都'),['lithium','ion','京都']);
  const out=search([{videoId:'cafe',start:35,text:'Café Lumière uses a burr grinder.',similarity:.01}],'"cafe lumiere"');assert.equal(out[0].videoId,'cafe');
});
test('scene and audio indicators remain attached to nearby matching evidence',()=>{
  const out=fuseMatches([{videoId:'a',start:42,score:.8,speechGenerated:true}],[{videoId:'a',start:40,score:.3,scene:true,key:'a:2'}],{perVideo:1});
  assert.deepEqual(out[0].matchSources,['Audio','Scene']);assert.equal(out[0].start,42);
});
