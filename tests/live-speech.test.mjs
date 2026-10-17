import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLiveSpeech, downsample, speechSegments} from '../lib/live-speech.js';
const tick=()=>new Promise(r=>setImmediate(r));
const id='aaaaaaaaaaa', samples=()=>new Float32Array(16000).fill(0.1);
function fixture(overrides={}) {
 let clock={video:{videoId:id,title:'Battery science'},time:100,rate:1,paused:false,seeking:false,ad:false,revision:0};
 const saved=[],states=[];let closes=0,released=0,calls=0;
 const controller=createLiveSpeech({prepareModel:async progress=>progress(1),transcribe:async()=>{calls++;return{text:'Battery charging reduces energy capacity',chunks:[{text:'Battery charging reduces energy capacity',timestamp:[1,3]}]}},
  readClock:async()=>({...clock,time:++clock.time}),save:async data=>{saved.push(data);return{chunkCount:1}},
  openAudio:async()=>({close:async()=>{closes++},mute:()=>{}}),releaseModel:()=>{released++},onChange:s=>states.push(s),...overrides});
 return {controller,saved,states,clock,counts:()=>({closes,released,calls}),async start(){const ready=await controller.prepare({tabId:1,video:clock.video});await controller.start({id:ready.id,streamId:'fixture'});},async feed(n){for(let i=0;i<n;i++)await controller.packet(samples(),16000);await tick();}};
}
test('speech captures only played audio, maps timestamps, and releases resources on stop',async()=>{
 const f=fixture();await f.start();await f.feed(15);await f.controller.stop();
 assert.equal(f.saved.length,1);assert.equal(f.saved[0].rangeStart,100);assert.equal(f.saved[0].rangeEnd,115);
 assert.equal(f.saved[0].segments[0].start,101);assert.equal(f.controller.status().status,'idle');
 assert.deepEqual(f.counts(),{closes:1,released:1,calls:1});
});
test('pause and ads are excluded, and discontinuities split audio ranges',async()=>{
 const f=fixture();await f.start();await f.feed(3);f.clock.paused=true;await f.feed(2);f.clock.paused=false;f.clock.ad=true;await f.feed(2);
 f.clock.ad=false;f.clock.revision++;await f.feed(1);f.clock.time=200;await f.feed(3);await f.controller.stop();
 assert.equal(f.saved.length,2);assert.equal(f.saved[0].rangeEnd-f.saved[0].rangeStart,3);assert.equal(f.saved[1].rangeStart,200);
});
test('changing video stops capture and saves only the original video',async()=>{
 const f=fixture();await f.start();await f.feed(3);f.clock.video={videoId:'bbbbbbbbbbb'};await f.feed(1);await tick();
 assert.equal(f.controller.status().status,'idle');assert.ok(f.saved.every(d=>d.video.videoId===id));assert.match(f.controller.status().reason,/video changed/);
});
test('seeks and playback-rate changes cannot mix different timestamp ranges',async()=>{
 const f=fixture();await f.start();await f.feed(3);f.clock.revision++;f.clock.time=300;await f.feed(1);f.clock.rate=2;f.clock.revision++;await f.feed(1);
 // Give the clock two video seconds for each real second at 2x.
 for(let i=0;i<3;i++){f.clock.time++;await f.feed(1)}await f.controller.stop();
 assert.equal(f.saved.length,2);assert.equal(f.saved[1].rangeEnd-f.saved[1].rangeStart,6);assert.equal(f.saved[1].segments[0].dur,4);
});
test('silence is discarded without running recognition',async()=>{
 const f=fixture();await f.start();for(let i=0;i<15;i++)await f.controller.packet(new Float32Array(16000),16000);await f.controller.stop();
 assert.equal(f.counts().calls,0);assert.equal(f.saved.length,0);
});
test('slow recognition has bounded backlog and stops capture instead of dropping audio',async()=>{
 let release;let active=0,peak=0;
 const f=fixture({transcribe:async()=>{active++;peak=Math.max(peak,active);if(!release)await new Promise(r=>release=r);active--;return{text:'recognized words'};}});
 await f.start();await f.feed(50);assert.equal(f.counts().closes,1);assert.equal(f.controller.status().status,'stopping');
 release();await f.controller.stop();assert.equal(peak,1);assert.equal(f.saved.length,3);assert.equal(f.controller.status().status,'idle');assert.match(f.controller.status().reason,/keep up/);
});
test('recognition failures stop audio and leave a useful error',async()=>{
 const f=fixture({transcribe:async()=>{throw Error('model failed')}});await f.start();await f.feed(15);await tick();
 assert.equal(f.controller.status().status,'idle');assert.equal(f.counts().closes,1);assert.match(f.controller.status().reason,/model failed/);
});
test('a saved full caption transcript stops speech without replacing it',async()=>{
 const f=fixture({save:async()=>({skipped:true})});await f.start();await f.feed(15);await tick();
 assert.equal(f.controller.status().status,'idle');assert.match(f.controller.status().reason,/caption transcript/);
});
test('cancelling preparation prevents audio from starting later',async()=>{
 let ready;const f=fixture({prepareModel:()=>new Promise(r=>ready=r)});const preparing=f.controller.prepare({tabId:1,video:{videoId:id}});
 await f.controller.stop();ready();await assert.rejects(preparing,/cancelled/);await assert.rejects(f.controller.start({id:f.controller.status().id,streamId:'late'}),/cancelled/);assert.equal(f.counts().closes,0);
});
test('invalid timing stops capture, and duplicate starts are rejected',async()=>{
 const f=fixture();await f.start();await assert.rejects(f.controller.prepare({tabId:2,video:{videoId:id}}),/already/);
 f.clock.rate=NaN;await f.feed(1);await tick();assert.equal(f.controller.status().status,'idle');assert.match(f.controller.status().reason,/timing/);
});
test('resampling averages samples and timestamp conversion respects playback speed',()=>{
 assert.deepEqual([...downsample(Float32Array.from([1,2,3,4,5,6]),48000)],[2,5]);
 assert.throws(()=>downsample(samples(),8000),/Unsupported/);
 assert.deepEqual(speechSegments({text:'words'},42,2,3),[{start:42,dur:6,text:'words'}]);
});

test('speech noise tags and standalone filler never become saved moments',async()=>{
 const noisy={chunks:[{text:'[Music]',timestamp:[0,1]},{text:'(upbeat music)',timestamp:[1,2]},{text:'Thank you.',timestamp:[2,3]},{text:'[Music] Battery electrodes lose capacity.',timestamp:[3,5]}]};
 assert.deepEqual(speechSegments(noisy,40,1,5),[{start:43,dur:2,text:'Battery electrodes lose capacity.'}]);
 assert.equal(speechSegments({text:'Thank you for explaining battery chemistry.'},0,1,5)[0].text,'Thank you for explaining battery chemistry.');
 assert.equal(speechSegments({text:'I study (music theory) every day.'},0,1,5)[0].text,'I study (music theory) every day.');
 const f=fixture({transcribe:async()=>({text:'[Music] Thank you.'})});await f.start();await f.feed(15);await f.controller.stop();assert.equal(f.saved.length,0);
});

test('common Whisper music, blank and language tags never create searchable segments',()=>{
 for(const text of ['♪ ♪','[BLANK_AUDIO]','( Music )','*music*','(speaking in foreign language)','[ applause ]','12345 !!!','Thank you. Thank you.'])assert.deepEqual(speechSegments({text},0,1,10),[],text);
 assert.equal(speechSegments({text:'♪ [BLANK_AUDIO] *music* A battery loses capacity.'},0,1,10)[0].text,'A battery loses capacity.');
 assert.equal(speechSegments({text:'The lesson is (music theory) and [a minor scale].'},0,1,10)[0].text,'The lesson is (music theory) and [a minor scale].');
});
