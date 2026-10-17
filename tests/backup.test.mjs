import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restoreBackup} from '../lib/backup.js';
test('backup restore sends one video or image per durable request, in dependency order',async()=>{
 const calls=[],progress=[],videos=Array.from({length:53},(_,i)=>({videoId:String(i),chunks:[{text:'words'}]})),scenes=[{videoId:'0',image:'fixture'}];
 const result=await restoreBackup({format:'recall-export',videos,scenes},async message=>{calls.push(message);return {imported:message.data.videos.length}},state=>progress.push(state));
 assert.equal(result.imported,53);assert.equal(calls.length,54);assert.ok(calls.every(call=>call.data.videos.length+(call.data.scenes?.length||0)===1));assert.equal(calls.at(-1).data.scenes[0],scenes[0]);assert.deepEqual(progress.at(-1),{done:54,total:54,imported:53});
});
test('restore stops after a failed batch without claiming completed data was lost',async()=>{
 let calls=0;await assert.rejects(restoreBackup({format:'recall-export',videos:[{},{},{}]},async()=>++calls===2?{error:'offline'}:{imported:1}),/1\/3.*offline.*remain saved/);assert.equal(calls,2);
 await assert.rejects(restoreBackup({videos:[]},async()=>{throw Error('must not send')}),/Not a Recall/);
});

test('restore reports saved progress even when the message transport rejects',async()=>{
 let calls=0;await assert.rejects(restoreBackup({format:'recall-export',videos:[{},{}]},async()=>{if(++calls===2)throw Error('Channel closed');return {imported:1}}),/1\/2.*Channel closed.*remain saved/);
});
