import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recognizedScreenText,screenRecord,validateScreenFrame,novelScreenLines,cleanScreenLines} from '../lib/screen-text.js';
import {rank,playbackStart} from '../lib/search.js';
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

test('line deduplication preserves digits, negation, word order and new subtitles',()=>{
  for(const [before,after] of [['The dose is 10 mg','The dose is 90 mg'],['The battery is safe to use','The battery is not safe to use'],['Alice defeated Bob in the final','Bob defeated Alice in the final'],['The north door is locked','The south door is locked']]){
    assert.deepEqual(novelScreenLines([after],[{start:40,text:before,observedLines:[before]}],45),[after]);
  }
  const recent=[{start:40,text:'Old caption',observedLines:['NEWS LIVE','Old caption']}];
  assert.deepEqual(novelScreenLines(['NEWS LIVE','New caption','New caption'],recent,45),['New caption']);
  assert.deepEqual(novelScreenLines(['news   live'],recent,45),[]);
  assert.deepEqual(novelScreenLines(['NEWS LIVE'],recent,90),['NEWS LIVE'],'later occurrences keep their own timestamp');
  assert.deepEqual(novelScreenLines(['NEWS LIVE'],recent,0),['NEWS LIVE'],'seeking back beyond the time window keeps evidence');
});

test('OCR keeps fuller fragments in either order without confusing whole tokens',()=>{
  for(const words of [['Chemical','Chemical reactions trap lithium'],['Chemical reactions trap lithium','Chemical']]){
    assert.equal(recognizedScreenText(data(words.map(text=>line(text)))),'Chemical reactions trap lithium');
  }
  for(const words of [
    ['The dose is 10 mg','The dose is 90 mg'],
    ['The battery is safe to use','The battery is not safe to use'],
    ['Alice defeated Bob in the final','Bob defeated Alice in the final'],
    ['Use C','Use C++'],['The price is 5','The price is 5%'],
    ['A reactor','A reaction'],['A dose of 1.5 mg','A dose of 15 mg'],
  ])assert.equal(recognizedScreenText(data(words.map(text=>line(text)))),words.join(' '));
});
test('OCR observation metadata is bounded and survives backup record validation',()=>{
  const row=screenRecord({videoId:'aaaaaaaaaaa',start:42,text:'New caption',observedLines:['NEWS LIVE','New caption']});
  assert.deepEqual(row.observedLines,['NEWS LIVE','New caption']);assert.equal(row.text,'New caption');
  const lines=cleanScreenLines(Array.from({length:100},()=> 'a'.repeat(500)));
  assert.ok(lines.length<=40);assert.ok(lines.join('').length<=2000);
});
test('OCR playback starts early without changing observed timestamps or caption links',()=>{
  assert.equal(playbackStart({start:42,screenText:true}),39);assert.equal(playbackStart({start:2,screenText:true}),0);assert.equal(playbackStart({start:42}),42);
  const results=rank([1],{matrix:[1],dim:1,meta:[{videoId:'a',start:42,text:'caption',kind:'screen-text'}]},new Map([['a',{method:'history-title'}]]));
  assert.equal(results[0].start,42);assert.equal(playbackStart(results[0]),39);
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
