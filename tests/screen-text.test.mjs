import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recognizedScreenText,screenRecord,validateScreenFrame} from '../lib/screen-text.js';
import {rank} from '../lib/search.js';
import {hasImportExemption} from '../lib/retention.js';
import {compressedScene} from '../lib/scene-db.js';
const line=(text,confidence=90)=>({confidence,words:[{text,confidence}]});
const data=lines=>({blocks:[{paragraphs:[{lines}]}]});
test('screen recognition drops low-confidence scenery fragments and empty punctuation',()=>{
  assert.equal(recognizedScreenText(data([line('Chemical reactions'),line('trap lithium'),line('zxq',20),line('!!!'),line('Chemical')])),'Chemical reactions trap lithium');
  assert.equal(recognizedScreenText({text:'untrusted fallback',confidence:99}),'');
  assert.equal(screenRecord({videoId:'aaaaaaaaaaa',start:42,text:' hello\nworld '}).key,'aaaaaaaaaaa:8');
  assert.throws(()=>screenRecord({videoId:'bad',start:42,text:'hello'}),/Invalid/);
});
test('sharp frames are bounded before OCR decoding and reject external inputs',()=>{
  const header=Buffer.from([255,216,255,192,0,17,8,2,208,5,0,3,1,17,0,2,17,0,3,17,0]);
  const frame={video:{videoId:'aaaaaaaaaaa'},start:42,image:'data:image/jpeg;base64,'+header.toString('base64')};
  assert.equal(validateScreenFrame(frame),frame);
  assert.throws(()=>validateScreenFrame({...frame,image:'https://example.com/frame.jpg'}),/image/i);
  header[9]=255;assert.throws(()=>validateScreenFrame({...frame,image:'data:image/jpeg;base64,'+header.toString('base64')}),/1280/);
});
test('on-screen text remains a timestamped text match even on title-only videos',()=>{
  const result=rank([1],{matrix:[1],dim:1,meta:[{videoId:'a',start:42,text:'chemical reactions trap lithium',kind:'screen-text'}]},new Map([['a',{method:'history-title',title:'Science'}]]),{query:'chemical reactions'});
  assert.equal(result[0].titleOnly,false);assert.equal(result[0].start,42);assert.deepEqual(result[0].matchSources,['On-screen text']);
  assert.equal(hasImportExemption({method:'history-title',screenCount:1}),false);
});
test('scene images use compressed binary bytes without changing image content',async()=>{
  const encoded='data:image/jpeg;base64,'+Buffer.from([255,216,1,2,255,217]).toString('base64');
  const row=compressedScene({image:encoded,vec:new Float32Array(512)});
  assert.ok(row.image instanceof Blob);assert.deepEqual(new Uint8Array(await row.image.arrayBuffer()),Uint8Array.from([255,216,1,2,255,217]));
  assert.equal(row.bytes,6+2048+512);assert.equal(compressedScene(row).image,row.image);
});
