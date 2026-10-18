import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wordText,stem} from '../lib/search-language.js';
import {prepareQuery,createPool,addPassage,rankPool,nearTie} from '../lib/search.js';
import {searchIntent,matchesSource,searchWithFallback} from '../lib/search-intent.js';
const lexical=(query,text)=>{const p=createPool(prepareQuery(query));addPassage(p,{text},{title:'',channel:''},.3,(score,match)=>({score,match}));return rankPool(p)[0];};
test('word endings connect rotation, rotate, rotating and tires without substring matches',()=>{
  assert.equal(wordText('rotate rotating rotation rotations'), 'rotat rotat rotat rotat');
  assert.equal(wordText('tires planned planning studies'), 'tire plan plan study');
  assert.equal(lexical('tire rotation','rotate your tires').match,'close');
  assert.equal(lexical('tire rotation','entire nation').match,'related');
});
test('written numbers, digits and percent signs share lexical evidence',()=>{
  assert.equal(wordText('ten percent per week'),wordText('10% per week'));
  assert.equal(wordText('twenty-five, one hundred and ten, two thousand'), '25 110 2000');
  assert.equal(wordText('one two three'),'one two three');
  assert.deepEqual(prepareQuery('part one').terms,['part','1']);
  assert.equal(lexical('ten percent per week','10% per week').match,'close');
});
test('quotes retain exact phrase bonuses rather than stemming them',()=>{
  assert.ok(lexical('"rotate your tires"','rotate your tires').score>lexical('"rotate your tires"','rotation of your tires').score+.5);
});
test('explicit viewing context extracts site and rolling date filters',()=>{
  assert.deepEqual(searchIntent('the TikTok about tire rotation last week'),{query:'TikTok tire rotation',source:'tiktok.com',sinceDays:7,labels:['tiktok.com','past 7 days']});
  assert.equal(searchIntent('that Short I saw last week').query,'');
  assert.equal(searchIntent('the Instagram Reel about cooking').source,'instagram.com');
  assert.equal(searchIntent('Roblox from YouTube past month').sinceDays,30);
});
test('ordinary topic words, quoted titles and manual overrides stay searchable',()=>{
  for(const query of ['the short answer about inflation','what people ate before today','the today explained podcast','video about the past week of the war','how to grow on youtube','TikTok marketing','short film editing','Last Week Tonight','"the TikTok last week"','“on Instagram today”'])assert.equal(searchIntent(query).query,query);
  assert.equal(searchIntent('cooking last week',{sinceDays:30}).sinceDays,30);
  assert.equal(searchIntent('cooking last week',{infer:false}).query,'cooking last week');
});
test('site filters match actual hosts and native YouTube IDs',()=>{
  assert.ok(matchesSource({url:'https://www.tiktok.com/@a/video/123'},'tiktok.com'));
  assert.ok(matchesSource({videoId:'abcdefghijk'},'youtube.com'));
  assert.ok(!matchesSource({url:'https://tiktok.com.example.org/'},'tiktok.com'));
  assert.ok(!matchesSource({url:'broken'},'instagram.com'));
});

test('website passages without embedded owner IDs remain separate and sort safely',()=>{
  const pool=createPool(prepareQuery('same title'));
  for(const videoId of ['page:a','page:b'])addPassage(pool,{text:'same title',start:0},{videoId,title:'same title',channel:''},.5,(score,match)=>({videoId,score,match}),0);
  assert.deepEqual(rankPool(pool,{perVideo:1}).map(r=>r.videoId),['page:a','page:b']);
});

test('an explicit part number can beat a small semantic advantage for the wrong part',()=>{
  const pool=createPool(prepareQuery('building log cabin by hand part five'));
  for(const [videoId,text,semantic] of [['wrong','building log cabin by hand part 6',.8],['right','building log cabin by hand part 5',.72]])addPassage(pool,{videoId,text,start:0},{videoId,title:text,channel:''},semantic,(score,match)=>({videoId,score,match}));
  assert.equal(rankPool(pool,{perVideo:1})[0].videoId,'right');
});

test('common silent-e, doubled-consonant and ed noun forms do not collide',()=>{
  for(const [a,b] of [['care','caring'],['hope','hoping'],['hop','hopping'],['speed','speeds'],['speed','speeding']])assert.equal(stem(a),stem(b));
  assert.notEqual(stem('car'),stem('caring'));
  assert.notEqual(stem('new'),stem('news'));
  assert.equal(lexical('car','caring deeply').match,'related');
  assert.equal(lexical('speed','speeding safely').match,'close');
});
test('clear viewing phrases infer dates while inference-off preserves every word',()=>{
  assert.equal(searchIntent('a TikTok from last week').sinceDays,7);
  assert.equal(searchIntent('recipes earlier today').sinceDays,1);
  assert.equal(searchIntent('cooking I watched last week').sinceDays,7);
  assert.equal(searchIntent('how to grow on youtube').source,'');
  assert.equal(searchIntent('the TikTok about cooking',{infer:false}).query,'the TikTok about cooking');
});
test('empty inferred filters relax once while manual restrictions remain',async()=>{
  const calls=[],intent=searchIntent('a TikTok from last week',{sinceDays:30});
  const result=await searchWithFallback(intent,30,async filters=>{calls.push(filters);return {results:filters.source?[]:[{videoId:'found'}]};});
  assert.equal(result.relaxed,true);assert.equal(calls.length,2);
  assert.equal(calls[1].sinceDays,30);assert.equal(calls[1].source,'');
  const unchanged=await searchWithFallback({...intent,labels:[]},30,async()=>({results:[]}));
  assert.equal(unchanged.relaxed,false);
  const lastPage=await searchWithFallback(intent,30,async()=>({results:[],hasFirst:true}));
  assert.equal(lastPage.relaxed,false);
});

test('article visual evidence never produces a text-score near-tie hint',()=>{
 assert.equal(nearTie([{videoId:'a',score:.5,articleImage:true,matchSources:['Article image']},{videoId:'b',score:.49}]),false);
});
