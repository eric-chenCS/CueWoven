import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

async function capture(forced) {
  let runtimeListener;let browserWindow;const messages=[];const events=new Map();
  const location=new URL(`https://www.youtube.com/watch?v=aaaaaaaaaaa${forced?'&recall_index=1':''}`);
  const ctx={URLSearchParams,location,Date,setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;},clearTimeout,
    document:{hidden:false,addEventListener(){},removeEventListener(){}},
    chrome:{storage:{local:{get:async()=>({settings:{enabled:true}})}},runtime:{
      onMessage:{addListener:fn=>{runtimeListener=fn;}},
      sendMessage:async msg=>{messages.push(msg);return msg.type==='should-index'?{index:true}:{chunkCount:1};},
    }},
    addEventListener:(type,fn)=>events.set(type,fn),
    postMessage(msg){if(msg.type==='getTranscript') events.get('message')({source:browserWindow,origin:location.origin,data:{source:'recall-main',type:'transcript',reqId:msg.reqId,segments:[{start:0,text:'test'}]}});},
  };
  ctx.window=ctx;vm.createContext(ctx);
  browserWindow=vm.runInContext('window',ctx);
  vm.runInContext(readFileSync(new URL('../content/yt-bridge.js',import.meta.url),'utf8'),ctx);
  events.get('message')({source:browserWindow,origin:location.origin,data:{source:'recall-main',type:'video',video:{videoId:'aaaaaaaaaaa',title:'Test',watchedAt:123}}});
  await new Promise(resolve=>runtimeListener({type:'index-now'},{},resolve));
  return messages;
}

test('live captures send a current watch date in both eligibility and indexing messages',async()=>{
  const started=Date.now();const messages=await capture(false);
  assert.ok(messages.find(m=>m.type==='should-index').watchedAt>=started);
  assert.ok(messages.find(m=>m.type==='index-video').video.watchedAt>=started);
});
test('a leftover recall_index link is treated as a normal watch',async()=>{
  const messages=await capture(true);
  assert.ok(messages.find(m=>m.type==='should-index').watchedAt>0);
});
