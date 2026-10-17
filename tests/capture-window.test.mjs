import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCaptureWindow} from '../lib/capture-window.js';
function fixture() {
 const tabs = new Map(), created = [], removed = [];
 let next = 10, stored = {};
 const api = {
  runtime:{getURL:p=>'chrome-extension://recall/'+p,getContexts:async ({tabIds,documentUrls})=>[...tabs.values()].filter(t=>tabIds.includes(t.id)&&documentUrls.includes(t.url))},
  windows:{update:async (id,options)=>{assert.deepEqual(options,{state:'minimized'});return {id,...options};},create:async options=>{
   created.push(options);const windowId=next++,tab={id:next++,windowId,url:options.url};tabs.set(tab.id,tab);return {id:windowId,tabs:[tab]};
  }},
  tabs:{get:async id=>tabs.get(id),query:async ({windowId})=>[...tabs.values()].filter(t=>t.windowId===windowId),remove:async id=>{removed.push(id);tabs.delete(id)}},
  storage:{session:{set:async values=>Object.assign(stored,values),get:async()=>stored,remove:async key=>{delete stored[key]}}},
 };
 return {api,tabs,created,removed,stored,manager:createCaptureWindow(api)};
}
test('six simultaneous requests share one minimized, unfocused capture window',async()=>{
 const f=fixture();const ids=await Promise.all(Array.from({length:6},()=>f.manager.get()));
 assert.equal(new Set(ids).size,1);assert.equal(f.created.length,1);
 assert.deepEqual(f.created[0],{url:'chrome-extension://recall/capture/capture.html',type:'normal',state:'minimized',focused:false});
 assert.equal(f.stored.captureWindow.windowId,ids[0]);
 await f.manager.close();assert.equal(f.tabs.size,0);assert.equal(f.stored.captureWindow,undefined);
});
test('cleanup preserves user-added tabs and removes only the anchor and capture URLs',async()=>{
 const f=fixture();const windowId=await f.manager.get();
 f.tabs.set(50,{id:50,windowId,url:'https://example.com/keep'});
 f.tabs.set(51,{id:51,windowId,url:'https://www.youtube.com/watch?v=aaaaaaaaaaa'});
 f.tabs.set(52,{id:52,windowId,url:'https://www.youtube.com/watch?v=bbbbbbbbbbb&recall_index=1'});
 await f.manager.close();assert.deepEqual([...f.tabs.keys()],[50,51]);assert.ok(f.removed.includes(52));
});
test('a navigated or moved anchor never authorizes closing that window',async()=>{
 for(const move of [false,true]) {
  const f=fixture();await f.manager.get();const anchor=f.tabs.get(f.stored.captureWindow.anchorTabId);
  if(move)anchor.windowId=100;else anchor.url='https://example.com/keep';
  await f.manager.close();assert.deepEqual(f.removed,[]);
 }
});
test('recover cleans owned stale captures without touching other windows',async()=>{
 const f=fixture();const windowId=await f.manager.get();f.tabs.set(99,{id:99,windowId:100,url:'https://www.youtube.com/watch?v=aaaaaaaaaaa&recall_index=1'});
 const restarted=createCaptureWindow(f.api);await restarted.recover();assert.deepEqual([...f.tabs.keys()],[99]);assert.equal(f.stored.captureWindow,undefined);
});
test('closing capture manually prevents recreation until a new job begins',async()=>{
 const f=fixture();const id=await f.manager.get();assert.equal(f.manager.removed(id+50),false);assert.equal(f.manager.removed(id),true);
 await assert.rejects(f.manager.get(),/closed/);assert.equal(f.created.length,1);
 f.manager.begin();await f.manager.get();assert.equal(f.created.length,2);
});
test('window creation errors do not leave a permanently rejected creation promise',async()=>{
 const f=fixture();const create=f.api.windows.create;f.api.windows.create=async()=>{throw Error('Cannot open window')};
 await assert.rejects(f.manager.get(),/Cannot open/);f.api.windows.create=create;await f.manager.get();assert.equal(f.created.length,1);
});

test('new player tabs are re-minimized without focusing or reopening a closed window',async()=>{
 const f=fixture();const id=await f.manager.get();await f.manager.minimize(id);f.manager.removed(id);
 await assert.rejects(f.manager.minimize(id),/closed/);assert.equal(f.created.length,1);
});
