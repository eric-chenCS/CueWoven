import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wordText} from '../lib/search-language.js';
import {prepareQuery,createPool,addPassage,rankPool} from '../lib/search.js';
import {searchIntent,matchesSource} from '../lib/search-intent.js';
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
  assert.deepEqual(searchIntent('the TikTok about tire rotation last week'),{query:'tire rotation',source:'tiktok.com',sinceDays:7,labels:['tiktok.com','past 7 days']});
  assert.equal(searchIntent('that Short I saw last week').query,'');
  assert.equal(searchIntent('the Instagram Reel about cooking').source,'instagram.com');
  assert.equal(searchIntent('Roblox from YouTube past month').sinceDays,30);
});
test('ordinary topic words, quoted titles and manual overrides stay searchable',()=>{
  for(const query of ['TikTok marketing','short film editing','Last Week Tonight','"the TikTok last week"','“on Instagram today”'])assert.equal(searchIntent(query).query,query);
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
