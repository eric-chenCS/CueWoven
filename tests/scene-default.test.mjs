import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {DEFAULT_SETTINGS,defaultsForMemory,resetPreferences} from '../lib/settings.js';

test('scene snapshots default off on every device and reset returns to off',()=>{
 assert.equal(DEFAULT_SETTINGS.scenesEnabled,false);assert.equal(DEFAULT_SETTINGS.articleImagesEnabled,false);
 for(const capacity of [undefined,8*1024**3,16*1024**3])assert.equal(defaultsForMemory(capacity).scenesEnabled,false);
 assert.equal(resetPreferences({scenesEnabled:true}).settings.scenesEnabled,false);
 assert.equal(resetPreferences({articleImagesEnabled:true}).settings.articleImagesEnabled,false);
 assert.equal(DEFAULT_SETTINGS.speechEnabled,true);assert.equal(DEFAULT_SETTINGS.screenTextEnabled,true);
});
test('classic scene capture does no probe work without explicit opt-in, and stops if it is removed',()=>{
 const timers=new Map();let next=0,changed;
 const context={__recallScenePolicy:{PROBE_MS:500,createBudget:()=>({})},chrome:{storage:{onChanged:{addListener:fn=>{changed=fn;}}}},setTimeout:fn=>{const id=++next;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),window:{addEventListener(){}},document:{addEventListener(){}}};
 vm.runInNewContext(readFileSync(new URL('../content/scene-capture.js',import.meta.url),'utf8'),context);
 for(const scenesEnabled of [undefined,false]){context.__recallScenes.start(()=>({}),{enabled:true,scenesEnabled});assert.equal(timers.size,0);}
 context.__recallScenes.start(()=>({}),{enabled:true,scenesEnabled:true});assert.equal(timers.size,1);
 changed({settings:{newValue:{enabled:true}}},'local');assert.equal(timers.size,0);
 changed({settings:{newValue:{enabled:true,scenesEnabled:true}}},'local');assert.equal(timers.size,1);
 changed({settings:{newValue:{enabled:true,scenesEnabled:false}}},'local');assert.equal(timers.size,0);
});
