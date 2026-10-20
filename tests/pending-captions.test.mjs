import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(){
  const events=new Map(),messages=[];
  let listener,changed,reply,browserWindow;
  const saved={settings:{enabled:true,dwellSeconds:3600},webCapture:{blocked:[]}};
  const location=new URL('https://www.youtube.com/watch?v=aaaaaaaaaaa');
  const dispatch=data=>(events.get('message')||[]).forEach(fn=>fn({source:browserWindow,origin:location.origin,data:{source:'recall-main',...data}}));
  const context={location,URLSearchParams,Date,innerWidth:1000,innerHeight:800,
    setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;},clearTimeout,
    document:{hidden:false,querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}},
    chrome:{storage:{local:{get:async()=>saved},onChanged:{addListener:fn=>changed=fn}},runtime:{
      onMessage:{addListener:fn=>listener=fn},sendMessage:async msg=>{messages.push(msg);return msg.type==='should-index'?{index:true}:{chunkCount:1};}}},
    addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);},
    postMessage:msg=>{if(msg.type==='getTranscript')reply=()=>dispatch({type:'transcript',reqId:msg.reqId,segments:[{start:0,text:'Delayed captions'}]});}
  };
  context.window=context;vm.createContext(context);browserWindow=vm.runInContext('window',context);
  vm.runInContext(readFileSync(new URL('../content/yt-bridge.js',import.meta.url),'utf8'),context);
  dispatch({type:'video',video:{videoId:'aaaaaaaaaaa',title:'Original video'}});await tick();
  const result=new Promise(resolve=>listener({type:'index-now'},{},resolve));await tick();
  assert.equal(typeof reply,'function','caption retrieval is pending');
  return {messages,result,reply,dispatch,async pause(){const oldValue=saved.settings;saved.settings={...oldValue,enabled:false};changed({settings:{oldValue,newValue:saved.settings}},'local');await tick();},
    async resume(){const oldValue=saved.settings;saved.settings={...oldValue,enabled:true};changed({settings:{oldValue,newValue:saved.settings}},'local');await tick();},
    async exclude(){saved.webCapture={blocked:['youtube.com']};changed({webCapture:{newValue:saved.webCapture}},'local');await tick();}};
}

for(const scenario of ['pause','pause then resume','exclude','navigate'])test('pending captions are discarded after '+scenario,async()=>{
  const f=await fixture();
  if(scenario==='navigate')f.dispatch({type:'video-reset'});
  else if(scenario==='exclude')await f.exclude();
  else {await f.pause();if(scenario==='pause then resume')await f.resume();}
  f.reply();const result=await f.result;
  assert.equal(result.ok,false);
  assert.equal(f.messages.some(msg=>['index-video','index-failed','speech-auto-start'].includes(msg.type)),false);
});

test('unchanged pending captions still save normally',async()=>{
  const f=await fixture();f.reply();assert.equal((await f.result).ok,true);
  assert.equal(f.messages.filter(msg=>msg.type==='index-video').length,1);
});
