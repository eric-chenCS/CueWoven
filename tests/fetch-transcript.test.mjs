import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchTranscript, pageObjects} from '../lib/fetch-transcript.js';
const id = 'aaaaaaaaaaa';
const url = `https://www.youtube.com/api/timedtext?v=${id}&sig=one-use`;
const player = {videoDetails:{videoId:id,title:'Title } with "quotes"',author:'Channel'},captions:{playerCaptionsTracklistRenderer:{captionTracks:[{baseUrl:url,languageCode:'en'}]}}};
const captions = JSON.stringify({events:[0,1,2].map(i=>({tStartMs:42000+i*1000,segs:[{utf8:`Caption ${i}`}]}))});
const html = (p=player) => `<script>var ytInitialPlayerResponse = ${JSON.stringify(p)};</script>`;
const mock = (watch=html(), caption=captions) => {
 const calls=[];
 return {calls,fetcher:async (u,o) => {calls.push({url:String(u),options:o});return new Response(String(u).includes('/watch?')?watch:caption);}};
};
test('extracts nested page JSON with escaped quotes and braces without running page code',()=>{
 const objects=pageObjects(html()+'; throw Error("must not execute")',/\bytInitialPlayerResponse\s*=\s*/g);
 assert.deepEqual(objects,[player]);
 assert.deepEqual(pageObjects('ytInitialPlayerResponse = {broken};',/\bytInitialPlayerResponse\s*=\s*/g),[]);
});
test('downloads exact signed captions without creating a page, with timestamps and metadata',async()=>{
 const f=mock();const result=await fetchTranscript(id,f.fetcher);
 assert.equal(result.method,'background-captions');assert.equal(result.segments[0].start,42);
 assert.equal(result.video.title,player.videoDetails.title);assert.equal(result.video.watchedAt,undefined);
 assert.equal(f.calls.length,2);assert.equal(f.calls[1].url,url);
 assert.ok(f.calls.every(c=>c.options.credentials==='include'&&c.options.redirect==='error'&&c.options.signal instanceof AbortSignal));
});
test('tries json3 only after an empty exact response',async()=>{
 const calls=[];const result=await fetchTranscript(id,async u=>{calls.push(u);return new Response(u.includes('/watch?')?html():u.includes('fmt=json3')?captions:'')});
 assert.equal(result.segments.length,3);assert.equal(calls.length,3);assert.equal(calls[1],url);
});
test('supports XML captions',async()=>{
 const f=mock(html(),'<transcript>'+[1,2,3].map(n=>`<text start="${n}">Text &amp; words</text>`).join('')+'</transcript>');
 const result=await fetchTranscript(id,f.fetcher);assert.equal(result.segments[0].text,'Text & words');
});
test('rejects caption URLs outside the permitted host/video/path before requesting them',async()=>{
 for(const baseUrl of ['https://evil.example/api/timedtext?v='+id,'http://www.youtube.com/api/timedtext?v='+id,'https://www.youtube.com/private?v='+id,'https://www.youtube.com/api/timedtext?v=bbbbbbbbbbb','https://x:y@www.youtube.com/api/timedtext?v='+id]){
  const p=structuredClone(player);p.captions.playerCaptionsTracklistRenderer.captionTracks[0].baseUrl=baseUrl;const f=mock(html(p));
  await assert.rejects(fetchTranscript(id,f.fetcher),/Invalid caption URL/);assert.equal(f.calls.length,1);
 }
});
test('mismatched player data cannot import another video transcript',async()=>{
 const p=structuredClone(player);p.videoDetails.videoId='bbbbbbbbbbb';const f=mock(html(p));
 await assert.rejects(fetchTranscript(id,f.fetcher),/No accessible captions/);assert.equal(f.calls.length,1);
});
test('uses transcript API parameters and context from the fetched page when captions are blocked',async()=>{
 const context={client:{clientName:'WEB',clientVersion:'fixture'}};
 const watch=html()+`ytInitialData = ${JSON.stringify({getTranscriptEndpoint:{params:'fixture-params'}})};ytcfg.set({"small":true});ytcfg.set(${JSON.stringify({INNERTUBE_CONTEXT:context})});`;
 const f=mock(watch,'');f.fetcher=async(u,o)=>{f.calls.push({url:String(u),options:o});return new Response(u.includes('/watch?')?watch:u.includes('get_transcript')?JSON.stringify({actions:[1,2,3].map(n=>({transcriptSegmentRenderer:{startMs:n*1000,snippet:{runs:[{text:'API words'}]}}}))}):'')};
 const result=await fetchTranscript(id,f.fetcher);assert.equal(result.method,'background-transcript-api');
 assert.deepEqual(JSON.parse(f.calls.at(-1).options.body),{context,params:'fixture-params'});
});
test('empty and unavailable captions fail honestly without fabricating a transcript',async()=>{
 for(const watch of [html(),'<html>Consent required</html>'])await assert.rejects(fetchTranscript(id,mock(watch,'').fetcher),/player|No accessible captions/);
});
test('rate limits surface once without retries',async()=>{
 let calls=0;await assert.rejects(fetchTranscript(id,async()=>{calls++;return new Response('',{status:429})}),e=>e.rateLimited&&/limiting/.test(e.message));assert.equal(calls,1);
 const f=mock();f.fetcher=async u=>{f.calls.push(u);return u.includes('/watch?')?new Response(html()):new Response('',{status:429})};
 await assert.rejects(fetchTranscript(id,f.fetcher),e=>e.rateLimited);assert.equal(f.calls.length,2);
});
test('caps response bodies and validates IDs before fetching',async()=>{
 await assert.rejects(fetchTranscript(id,mock('x'.repeat(8*1024*1024+1)).fetcher),/too large/);
 let calls=0;await assert.rejects(fetchTranscript('bad&x=1',()=>{calls++}),/Invalid video ID/);assert.equal(calls,0);
});
