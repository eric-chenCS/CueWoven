import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wordText,stem} from '../lib/search-language.js';
import {prepareQuery,createPool,addPassage,rankPool,nearTie,watchedWithin} from '../lib/search.js';
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
test('empty date filters relax once while website and manual restrictions remain',async()=>{
  const calls=[],intent=searchIntent('a TikTok from last week',{sinceDays:30});
  const result=await searchWithFallback(intent,30,async filters=>{calls.push(filters);return {results:[]};});
  assert.equal(result.relaxed,false);assert.equal(calls.length,1);
  const datedCalls=[],dated=searchIntent('a TikTok from last week');
  const retried=await searchWithFallback(dated,0,async filters=>{datedCalls.push(filters);return {results:filters.sinceDays?[]:[{videoId:'found'}]};});
  assert.equal(retried.relaxed,true);assert.equal(datedCalls.length,2);
  assert.equal(datedCalls[1].sinceDays,0);assert.equal(datedCalls[1].source,'tiktok.com');
  assert.deepEqual(retried.intent.labels,['tiktok.com']);
  const unchanged=await searchWithFallback({...intent,labels:[]},30,async()=>({results:[]}));
  assert.equal(unchanged.relaxed,false);
  const lastPage=await searchWithFallback(intent,30,async()=>({results:[],hasFirst:true}));
  assert.equal(lastPage.relaxed,false);
});

test('explicit website memories select a host without interpreting topic mentions as filters',()=>{
  for(const [query,host] of [
    ['a YouTube video about back pain','youtube.com'],['YouTube videos about aging','youtube.com'],
    ['that YouTube video about getting older','youtube.com'],['a Reddit thread about keyboards','reddit.com'],
    ['the Wikipedia article about coral','wikipedia.org'],['a GitHub page about compilers','github.com'],
    ['a Vimeo clip about art','vimeo.com'],['I read about coral on Wikipedia','wikipedia.org'],
    ['an article from www.nature.com about coral','nature.com'],['coral from science.example.edu','science.example.edu'],
    ['I watched a video on youtube.com.evil.org about aging','youtube.com.evil.org'],
  ])assert.equal(searchIntent(query).source,host,query);
  for(const query of ['an article about YouTube','an article about YouTube videos','how YouTube videos are recommended','YouTube marketing','how to grow on youtube','a guide to posting on GitHub','"a YouTube video about aging"','“from nature.com”','nature.com security research'])assert.equal(searchIntent(query).source,'',query);
  assert.equal(searchIntent('a YouTube video about aging',{infer:false}).source,'');
});

test('website-only empty searches never query another website',async()=>{
  for(const query of ['a YouTube video about back pain','an article from nature.com about coral']){
    const intent=searchIntent(query),calls=[];
    const result=await searchWithFallback(intent,0,async filters=>{calls.push(filters);return {results:[]};});
    assert.equal(calls.length,1);assert.equal(result.relaxed,false);assert.equal(result.intent.source,intent.source);
  }
  assert.equal(matchesSource({url:'https://youtube.com.evil.org/watch'},'youtube.com'),false);
});

test('website filters survive sentence punctuation and explicit HTTP URLs without aliasing lookalikes',()=>{
  for(const [query,host] of [
    ['an article from nature.com.','nature.com'],['an article from nature.com, about coral','nature.com'],
    ['I read it on nature.com!','nature.com'],['an article from https://www.nature.com/articles/coral','nature.com'],
    ['an article from http://nature.com/research','nature.com'],
    ['a video from YouTube.','youtube.com'],['I watched it on YouTube!','youtube.com'],['I read it on GitHub.','github.com'],
    ['a video on https://youtube.com.evil.test/watch','youtube.com.evil.test'],
    ['a video I watched on youtube.com.evil.test.','youtube.com.evil.test'],
    ['a page from https://Example.ORG/path?q=coral','example.org'],
  ])assert.equal(searchIntent(query).source,host,query);
  for(const query of ['a video I watched on youtube.com@evil.test','from youtube-notes','from https://youtube.com@evil.test/watch','a video I watched on youtube.com..evil.test','a video I watched on youtube.com.@evil.test'])assert.equal(searchIntent(query).source,'',query);
});

test('article visual evidence never produces a text-score near-tie hint',()=>{
 assert.equal(nearTie([{videoId:'a',score:.5,articleImage:true,matchSources:['Article image']},{videoId:'b',score:.49}]),false);
});

// Fixed local "now" (Mon Oct 19 2026, 2 PM) so typed date windows are deterministic.
const NOW=new Date(2026,9,19,14).getTime(),DAY=864e5;
const windowOf=(text,options={})=>searchIntent(text,{now:NOW,...options});
test('typed "ago" dates become padded date windows and leave the topic words',()=>{
  const days=windowOf('cat video 3 days ago');
  assert.equal(days.query,'cat video');assert.deepEqual(days.range,{sinceMs:NOW-4*DAY,untilMs:NOW-2*DAY});assert.equal(days.labels.length,1);
  const span=windowOf('react hooks 3-4 days ago');
  assert.equal(span.query,'react hooks');assert.deepEqual(span.range,{sinceMs:NOW-5*DAY,untilMs:NOW-2*DAY});
  const months=windowOf('the cooking video I watched between 1 and 2 months ago');
  assert.deepEqual(months.range,{sinceMs:NOW-60*DAY-7.5*DAY,untilMs:NOW-30*DAY+7.5*DAY});
  assert.deepEqual(windowOf('pasta a few weeks ago').range,{sinceMs:NOW-35*DAY-1.75*DAY,untilMs:NOW-14*DAY+1.75*DAY});
  assert.deepEqual(windowOf('battery talk two weeks ago').range,{sinceMs:NOW-17.5*DAY,untilMs:NOW-10.5*DAY});
});
test('date words that are usually topics need viewing words',()=>{
  for(const text of ['30 days of running','gardening in May','yesterday lyrics','the last 3 days of summer','"3 days ago" lyrics'])assert.equal(windowOf(text).range,undefined,text);
  const yesterday=windowOf('the video I watched yesterday about rockets');
  assert.equal(yesterday.query,'the video I watched about rockets');
  assert.deepEqual(yesterday.range,{sinceMs:new Date(2026,9,18).getTime(),untilMs:new Date(2026,9,19).getTime()});
  assert.deepEqual(windowOf('the TikTok I saw in September').range,{sinceMs:new Date(2026,8,1).getTime()-3*DAY,untilMs:new Date(2026,9,1).getTime()+3*DAY});
  assert.equal(windowOf('the video I watched in November').range.sinceMs,new Date(2025,10,1).getTime()-3*DAY);
  assert.deepEqual(windowOf('the clip I saw last 3 days').range,{sinceMs:NOW-3*DAY,untilMs:0});
});
test('a date picked in the popup wins over a typed one, and relaxing drops only typed dates',async()=>{
  assert.equal(windowOf('cat video 3 days ago',{manualRange:true}).range,undefined);
  assert.equal(windowOf('cat video 3 days ago',{sinceDays:7}).range,undefined);
  assert.equal(windowOf('cat video 3 days ago',{infer:false}).range,undefined);
  const intent=windowOf('cat video 3 days ago'),calls=[];
  const result=await searchWithFallback(intent,0,async filters=>{calls.push(filters);return {results:filters.range?[]:[{videoId:'found'}]};});
  assert.equal(result.relaxed,true);assert.equal(calls[1].range,undefined);assert.equal(calls[1].query,'cat video');
});
test('one date check keeps items watched inside the window from every source',()=>{
  const at=time=>({watchedAt:time});
  assert.equal(watchedWithin(at(5),{sinceMs:5,untilMs:10}),true);assert.equal(watchedWithin(at(10),{sinceMs:5,untilMs:10}),false);
  assert.equal(watchedWithin(at(4),{sinceMs:5}),false);assert.equal(watchedWithin(at(1),{untilMs:2}),true);
  assert.equal(watchedWithin({indexedAt:7},{sinceMs:5,untilMs:10}),true);assert.equal(watchedWithin(at(99)),true);
});


test('bounded comparative forms share lexical clues without changing literal quotes',()=>{
 for(const root of ['old','young','fast','slow','small','long','short','high','low','new','tall']){
  assert.equal(stem(root+'er'),stem(root));assert.equal(stem(root+'est'),stem(root));
 }
 assert.equal(wordText('lower lowered lowering lowers'),'low low low low');
 assert.equal(lexical('old back pain','getting older with a bad back').match,'close');
 assert.ok(lexical('"getting old"','getting old').score>lexical('"getting old"','getting older').score+.5);
 for(const word of ['flower','power','speaker','other','water','forest','border','fewer','news'])assert.equal(stem(word),word);
 assert.notEqual(stem('high'),stem('low'));
 assert.deepEqual(prepareQuery('not faster than 20').terms,['not','fast','than','20']);
});
