import {test} from 'node:test';
import assert from 'node:assert/strict';

const listener=()=>({addListener(){}});
let receive;
globalThis.chrome={
 storage:{local:{get:async()=>({liteModeInitialized:true,settings:{enabled:true}})}},
 runtime:{id:'test',getURL:path=>path,onMessage:{addListener(fn){receive=fn;}},onInstalled:listener()},
 alarms:{onAlarm:listener()},
};
await import('../background.js');
const request=(msg,url='popup/popup.html')=>new Promise(resolve=>assert.equal(receive(msg,{id:'test',url},resolve),true));

for(const reason of ['Receiving end does not exist','The message port closed before a response was received.','A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received']){
 test('recreates a lost engine before retrying: '+reason,async()=>{
  let exists=true,created=0,sent=0;
  chrome.runtime.getContexts=async()=>exists?[{}]:[];
  chrome.offscreen={createDocument:async()=>{created++;exists=true;}};
  chrome.runtime.sendMessage=async()=>{
   sent++;
   if(sent===1){exists=false;throw Error(reason);}
   if(!exists)throw Error('Receiving end does not exist');
   return {results:[{videoId:'aaaaaaaaaaa',start:42}]};
  };
  assert.deepEqual(await request({type:'search',query:'remembered words'}),{results:[{videoId:'aaaaaaaaaaa',start:42}]});
  assert.equal(created,1);assert.equal(sent,2);
 });
}

test('concurrent retries share a recreated engine',async()=>{
 let exists=true,created=0,sent=0,release;
 chrome.runtime.getContexts=async()=>exists?[{}]:[];
 chrome.offscreen={createDocument:async()=>{created++;await new Promise(resolve=>release=resolve);exists=true;}};
 chrome.runtime.sendMessage=async()=>{sent++;if(sent<=2){exists=false;throw Error('Receiving end does not exist');}return {results:[]};};
 const a=request({type:'search',query:'one detail'}),b=request({type:'search',query:'another detail'});
 const deadline=Date.now()+2000;
 while(!release&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,5));
 assert.ok(release,'retry never recreated the document');release();
 assert.deepEqual(await Promise.all([a,b]),[{results:[]},{results:[]}]);assert.equal(created,1);
});

for(const error of ['Invalid date range.','Receiving end does not exist','The message channel closed before a response was received.'])test('engine application errors are never treated as transport failures: '+error,async()=>{
 let sent=0,created=0;
 chrome.runtime.getContexts=async()=>[{}];chrome.offscreen={createDocument:async()=>created++};
 chrome.runtime.sendMessage=async()=>{sent++;return {error};};
 assert.deepEqual(await request({type:'search',query:'coral'}),{error});
 assert.equal(sent,1);assert.equal(created,0);
});

for(const empty of [false,true])test('a committed mutation with '+(empty?'an empty':'a lost')+' reply is never replayed',async()=>{
 let mutations=0;
 chrome.runtime.getContexts=async()=>[{}];
 chrome.runtime.sendMessage=async msg=>{
  if(msg.type==='speech-status')return {status:'idle'};
  mutations++;if(empty)return undefined;throw Error('The message port closed before a response was received.');
 };
 const result=await request({type:'clear'},'options/options.html');
 assert.match(result.error,/interrupted.*Check your library/);assert.equal(mutations,1);
});
