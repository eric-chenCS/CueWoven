import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restoreBackup} from '../lib/backup.js';
import {SCENE_STORAGE_CHOICES,sceneCaps} from '../lib/scenes.js';
const SCENES_TOTAL=sceneCaps(Math.max(...SCENE_STORAGE_CHOICES)).count;

test('restore retains the largest image storage choice instead of truncating to a smaller cap',async()=>{
 const scenes=Array.from({length:SCENES_TOTAL+1},(_,i)=>({videoId:'fixture',image:String(i)}));let count=0,first,last;
 await restoreBackup({format:'recall-export',videos:[],scenes},async message=>{const scene=message.data.scenes[0];first??=scene;last=scene;count++;return{imported:0}});
 assert.equal(count,SCENES_TOTAL);assert.equal(first.image,'1');assert.equal(last.image,String(SCENES_TOTAL));
});
test('backup restore sends one video or image per durable request, in dependency order',async()=>{
 const calls=[],progress=[],videos=Array.from({length:53},(_,i)=>({videoId:String(i),chunks:[{text:'words'}]})),scenes=[{videoId:'0',image:'fixture'}];
 const result=await restoreBackup({format:'recall-export',videos,scenes},async message=>{calls.push(message);return {imported:message.data.videos.length}},state=>progress.push(state));
 assert.equal(result.imported,53);assert.equal(calls.length,54);assert.ok(calls.every(call=>call.data.videos.length+(call.data.scenes?.length||0)===1));assert.equal(calls.at(-1).data.scenes[0],scenes[0]);assert.deepEqual(progress.at(-1),{done:54,total:54,imported:53});
});
test('restore stops after a failed batch without claiming completed data was lost',async()=>{
 let calls=0;await assert.rejects(restoreBackup({format:'recall-export',videos:[{},{},{}]},async()=>++calls===2?{error:'offline'}:{imported:1}),/1\/3.*offline.*remain saved/);assert.equal(calls,2);
 await assert.rejects(restoreBackup({videos:[]},async()=>{throw Error('must not send')}),/Not a CueWoven/);
});

test('restore reports saved progress even when the message transport rejects',async()=>{
 let calls=0;await assert.rejects(restoreBackup({format:'recall-export',videos:[{},{}]},async()=>{if(++calls===2)throw Error('Channel closed');return {imported:1}}),/1\/2.*Channel closed.*remain saved/);
});

test('restore errors stop immediately without replaying partially written requests',async()=>{
 for(const error of ['Wait for the backup restore to finish before changing saved data.','Stop speech-to-text before changing saved data.','Invalid image.']){let calls=0;await assert.rejects(restoreBackup({format:'recall-export',videos:[{}]},async()=>{calls++;return {error};}),/0\/1.*remain saved/);assert.equal(calls,1);}
});

test('on-screen text restore uses bounded batches after its parent videos',async()=>{
 const calls=[],progress=[];const screenText=Array.from({length:35},(_,i)=>({videoId:'a',start:i*5,text:'subtitle words'}));
 await restoreBackup({format:'recall-export',videos:[{}],screenText},async message=>{calls.push(message);return {imported:message.data.videos.length}},state=>progress.push(state));
 assert.equal(calls.length,4);assert.deepEqual(calls.slice(1).map(call=>call.data.screenText.length),[16,16,3]);assert.deepEqual(progress.at(-1),{done:36,total:36,imported:1});
});
