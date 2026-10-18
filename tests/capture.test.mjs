import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const id='aaaaaaaaaaa';
const signed=`https://www.youtube.com/api/timedtext?v=${id}&signature=test-token&fmt=srv3`;
const body=JSON.stringify({events:[0,1,2].map(i=>({tStartMs:i*1000,dDurationMs:1000,segs:[{utf8:`caption line ${i}`}]}))});

function fixture({on=true, fetchBody=()=>'', userChanges=false, clockStep=0, path='/watch', playerReady=true}={}) {
  const requests=[];const posted=[];const events=new Map();const docEvents=new Map();
  const location=new URL(`https://www.youtube.com${path}?v=${id}`);
  let pressed=String(on);let clicks=0;const buttonEvents=new Map();
  const button={isConnected:true,getAttribute:key=>key==='aria-pressed'?pressed:null,
    addEventListener:(key,fn)=>buttonEvents.set(key,fn),removeEventListener:key=>buttonEvents.delete(key),
    click(){
      clicks++;pressed=String(pressed!=='true');
      if(pressed==='true') {
        if(userChanges) docEvents.get('keydown')?.({isTrusted:true,key:'c'});
        ctx.fetch(signed);
      }
    }};
  class XHR {listeners=new Map();open(){}addEventListener(key,fn){this.listeners.set(key,fn);}emit(){this.listeners.get('load')?.();}}
  let time=0,timerCount=0;
  const ctx={URL,URLSearchParams,AbortSignal,XMLHttpRequest:XHR,location,
    Date: clockStep ? class extends Date {static now(){return time;}} : Date,
    setTimeout:(fn,ms)=>setTimeout(()=>{time+=clockStep;timerCount++;fn();},Math.min(ms,5)),clearTimeout,setInterval:fn=>{ctx.poll=fn},
    fetch:async url=>{requests.push(String(url));return new Response(fetchBody(String(url)));},
    document:{readyState:'complete',title:'Fixture - YouTube',
      getElementById:()=>({getPlayerResponse:()=>({videoDetails:{videoId:id,title:'Fixture'}})}),
      querySelector:selector=>selector==='.ytp-subtitles-button'?button:null,querySelectorAll:selector=>selector.includes('#shorts-player') && playerReady ? [{getPlayerResponse:()=>({videoDetails:{videoId:id,title:'Fixture',lengthSeconds:'12'}}),querySelector:()=>button}] : [],
      addEventListener:(key,fn)=>docEvents.set(key,fn),removeEventListener:key=>docEvents.delete(key)},
    addEventListener:(key,fn)=>events.set(key,fn),postMessage:msg=>posted.push(msg),
  };
  ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../lib/parse.js',import.meta.url),'utf8'),ctx);
  vm.runInContext(readFileSync(new URL('../content/yt-main.js',import.meta.url),'utf8'),ctx);
  const browserWindow=vm.runInContext('window',ctx);
  return {ctx,requests,button,posted,docEvents,location,state:()=>({pressed,clicks}),timerCount:()=>timerCount,async request(){
    await events.get('message')({source:browserWindow,origin:location.origin,data:{source:'recall-bridge',type:'getTranscript',videoId:id,reqId:1,allowDom:false}});
    return posted.find(m=>m.type==='transcript');
  }};
}

test('uses the player fetch response body without replaying a one-use signed URL',async()=>{
  let uses=0;const f=fixture({on:false,fetchBody:url=>url===signed&&uses++===0?body:''});
  await f.ctx.fetch(signed);await new Promise(resolve=>setTimeout(resolve,15));
  const result=await f.request();
  assert.equal(result.method,'player-captions');assert.equal(result.segments.length,3);
  assert.deepEqual(f.requests,[signed]);assert.deepEqual(f.state(),{pressed:'false',clicks:0});
});

for (const path of [`/shorts/${id}`, `/live/${id}`, '/watch']) test(`detects ${path} immediately without waiting for player data`, () => {
  const f=fixture({path,playerReady:false});
  const video=f.posted.find(row=>row.type==='video')?.video;
  assert.equal(video?.videoId,id);assert.equal(video?.shortForm,path.startsWith('/shorts/'));
  assert.equal(f.timerCount(),0);
});

test('feed polling detects a new Short even without a navigation event', () => {
  const f=fixture({path:`/shorts/${id}`});
  f.location.pathname='/shorts/bbbbbbbbbbb';f.ctx.poll();
  assert.equal(f.posted.at(-1).video.videoId,'bbbbbbbbbbb');
});

test('captures caption XHR response bodies without another network request',async()=>{
  const f=fixture();const xhr=new f.ctx.XMLHttpRequest();xhr.open('GET',signed);
  xhr.responseType='';xhr.responseText=body;xhr.emit();
  assert.equal((await f.request()).segments.length,3);assert.equal(f.requests.length,0);
});

test('replays the exact signed URL before attempting a format change',async()=>{
  const f=fixture({fetchBody:url=>url===signed?body:''});
  new f.ctx.XMLHttpRequest().open('GET',signed);
  assert.equal((await f.request()).segments.length,3);assert.deepEqual(f.requests,[signed]);
});

test('temporarily enables captions, captures the player response and restores captions off',async()=>{
  const f=fixture({on:false,fetchBody:()=>body});
  const result=await f.request();
  assert.equal(result.method,'player-request');assert.equal(result.segments.length,3);
  assert.deepEqual(f.state(),{pressed:'false',clicks:2});
});

test('does not restore over a user caption change during capture',async()=>{
  const f=fixture({on:false,fetchBody:()=>body,userChanges:true});
  assert.equal((await f.request()).segments.length,3);
  assert.deepEqual(f.state(),{pressed:'true',clicks:1});
});

test('caption polling uses elapsed time when inactive tabs throttle timers',async()=>{
  const f=fixture({on:false,clockStep:1000});
  assert.match((await f.request()).error,/No transcript found/);
  assert.equal(f.timerCount(),5,'a 4.5-second wait must not become 15 slow timer cycles');
  assert.equal(f.state().pressed,'false');
});

test('A to home to A announces the video again in the same document',async()=>{
 const f=fixture();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.posted.filter(row=>row.type==='video').length,1);
 f.location.pathname='/';f.location.search='';await f.docEvents.get('yt-navigate-finish')();assert.equal(f.posted.at(-1).type,'video-reset');
 f.location.pathname='/watch';f.location.search='?v='+id;await f.docEvents.get('yt-navigate-finish')();assert.equal(f.posted.filter(row=>row.type==='video').length,2);
});
