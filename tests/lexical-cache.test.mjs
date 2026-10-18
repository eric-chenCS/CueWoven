import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLexicalCache,warmLexical} from '../lib/lexical-cache.js';
test('cached words invalidate on changed text, preserve numbers, and never change persisted rows',()=>{
 const cache=createLexicalCache({rowBudget:200,textBudget:200}),row={text:'rotate tires ten percent tires'};
 assert.equal(cache.words(row),'rotat tire 10 percent');
 row.text='caring speeds';assert.equal(cache.words(row),'care speed');
 for(let i=0;i<100;i++)cache.words({text:'unique '+i});
 assert.equal(cache.words(row),'care speed');
 assert.deepEqual(Object.keys(row),['text']);cache.clear();assert.equal(cache.words(row),'care speed');
});
test('large cold preparation yields and resumes without dropping any passage',async()=>{
 const rows=Array.from({length:1000},(_,i)=>({text:('rotate tires ten percent '.repeat(20))+i}));
 let yielded=0;const cache=createLexicalCache();
 await warmLexical(rows,{cache,yieldTask:async()=>{yielded++;}});
 assert.ok(yielded>0);assert.ok(cache.words(rows.at(-1)).includes('999'));
});

test('clearing during incremental preparation stops stale rows being cached',async()=>{
 const rows=Array.from({length:500},()=>({text:'private old passage '.repeat(100)}));
 let calls=0,generation=0;
 const cache={get generation(){return generation;},words(){calls++;const start=performance.now();while(performance.now()-start<1){};}};
 await warmLexical(rows,{cache,yieldTask:async()=>{generation++;}});
 assert.ok(calls<rows.length);
});
