import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankScenes,fuseMatches,validateScene,SCENES_TOTAL,SCENES_PER_VIDEO,SCENE_BYTES_TOTAL,IMAGES_PER_PAGE} from '../lib/scenes.js';
const hit=(videoId,start,score,extra={})=>({videoId,start,score,title:videoId,...extra});
test('fusion includes visual-only matches without comparing raw cosine scales',()=>{
  const out=fuseMatches([hit('weak-title',0,0.3,{titleOnly:true})],[hit('cats',20,0.27,{scene:true})],{perVideo:1});
  assert.equal(out[0].videoId,'cats');assert.deepEqual(out[0].matchSources,['Scene']);
});
test('strong transcript matches keep their timestamp and nearby scene evidence',()=>{
  const out=fuseMatches([hit('battery',42,0.8)],[hit('battery',40,0.28,{scene:true,key:'snapshot'})],{perVideo:1});
  assert.equal(out[0].start,42);assert.equal(out[0].sceneStart,40);assert.deepEqual(out[0].matchSources,['Transcript','Scene']);
});
test('distant scene evidence does not claim to confirm a transcript moment',()=>{
  const out=fuseMatches([hit('battery',42,0.8)],[hit('battery',200,0.28,{scene:true})],{perVideo:1});
  assert.equal(out[0].start,42);assert.deepEqual(out[0].matchSources,['Transcript']);
});
test('fusion paginates across all matching videos, with stable unique-video pages',()=>{
  const words=Array.from({length:25},(_,i)=>hit('word'+i,i*20,0.8));
  const scenes=Array.from({length:25},(_,i)=>hit('scene'+i,i*20,0.28,{scene:true}));
  const all=fuseMatches(words,scenes,{limit:100,perVideo:1});
  assert.equal(new Set(all.map(h=>h.videoId)).size,50);
  for(let i=0;i<50;i++)assert.equal(fuseMatches(words,scenes,{offset:i,limit:1,perVideo:1})[0].videoId,all[i].videoId);
});
test('scene ranking filters weak, orphan, wrong-dimension and old matches',()=>{
  const videos=new Map([['a',{watchedAt:10}],['old',{watchedAt:1}]]);
  const scenes=[{key:'a:1',videoId:'a',start:20,vec:[1,0]},{key:'old:1',videoId:'old',vec:[1,0]},{key:'orphan:1',videoId:'missing',vec:[1,0]},{key:'a:2',videoId:'a',vec:[0.1,0.99]},{key:'a:3',videoId:'a',vec:[1]}];
  const results=rankScenes([1,0],scenes,videos,{sinceMs:5});assert.equal(results.length,1);assert.equal(results[0].start,20);assert.equal(results[0].scene,true);
});
test('scene input rejects external images, oversized data, decompression bombs and bad timestamps',()=>{
  const scene={video:{videoId:'aaaaaaaaaaa'},start:20,image:'https://example.com/private.jpg'};
  assert.throws(()=>validateScene(scene),/image/);
  assert.throws(()=>validateScene({...scene,start:-1}),/timestamp/);
  assert.throws(()=>validateScene({...scene,image:'data:image/jpeg;base64,'+'a'.repeat(100000)}),/image/);
  const jpeg=Buffer.from([255,216,255,192,0,17,8,0,180,1,64,3,1,17,0,2,17,0,3,17,0]);
  const good={...scene,image:'data:image/jpeg;base64,'+jpeg.toString('base64')};
  assert.equal(validateScene(good).key,'aaaaaaaaaaa:1');
  const early=validateScene({...good,start:21,adaptive:true}),late=validateScene({...good,start:27,adaptive:true});assert.notEqual(early.key,late.key);assert.notEqual(early.key,validateScene({...good,start:21}).key);assert.equal(late.adaptive,true);
  jpeg[9]=255;assert.throws(()=>validateScene({...good,image:'data:image/jpeg;base64,'+jpeg.toString('base64')}),/320/);
  assert.equal(SCENES_TOTAL,20000);assert.equal(SCENE_BYTES_TOTAL,240*1024*1024);assert.equal(SCENES_PER_VIDEO,240);assert.equal(IMAGES_PER_PAGE,3);
});

test('noise-floor scene hits cannot displace eligible transcripts',()=>{
 const words=[hit('strong',42,.8),hit('decent',80,.4)],scenes=[hit('noise',20,.23,{scene:true})];
 assert.deepEqual(fuseMatches(words,scenes).map(row=>row.videoId),['strong','decent']);
 const videos=new Map([['noise',{}],['useful',{}]]);
 const ranked=rankScenes([1,0],[{key:'noise:1',videoId:'noise',vec:[.23,.97]},{key:'useful:1',videoId:'useful',vec:[.27,.96]}],videos);
 assert.deepEqual(ranked.map(row=>row.videoId),['useful']);
});

test('article images have stable distinct keys and cannot masquerade as video frames',()=>{
 const video={videoId:'web_'+'a'.repeat(64),kind:'page'},image='data:image/jpeg;base64,'+Buffer.from([255,216,255,192,0,17,8,0,180,1,64,3,1,17,0,2,17,0,3,17,0]).toString('base64');
 const input={video,image,start:0,caption:'A diagram',imageId:'b'.repeat(64),articleImage:true};
 assert.match(validateScene(input).key,/:image:/);assert.equal(validateScene(input).adaptive,false);
 assert.throws(()=>validateScene({...input,video:{...video,kind:'video'}}),/Invalid/);
 assert.throws(()=>validateScene({...input,imageId:'bad'}),/Invalid/);
 const results=rankScenes([1,0],[{...validateScene(input),videoId:video.videoId,vec:[1,0]}],new Map([[video.videoId,video]]));
 assert.equal(results[0].articleImage,true);assert.equal(results[0].caption,'A diagram');
 assert.deepEqual(results[0].matchSources,['Article image']);
 const words=[hit(video.videoId,0,.6,{kind:'page',titleOnly:true,matchSources:['Title']})];
 const fused=fuseMatches(words,results,{perVideo:1});assert.equal(fused[0].articleImage,true);assert.deepEqual(fused[0].matchSources,['Title','Article image']);
});
