import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeScreenLines,recognizedScreenLines} from '../lib/screen-text.js';
import {createOcrModel} from '../offscreen/ocr-model.js';

const data=lines=>({blocks:[{paragraphs:[{lines:lines.map(text=>({confidence:95,words:[{text,confidence:95}]}))}]}]});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('20,000 generated OCR comparisons retain changed numbers, meaning, symbols and word order',()=>{
  let seed=0x5eed;
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(let i=0;i<1000;i++){
    const dose=next()%9000+10,other=dose+1,alice=`Alice${next()%10000}`,bob=`Bob${next()%10000}`;
    const pairs=[
      [`The dose is ${dose} mg`,`The dose is ${other} mg`],
      [`The battery ${i} is safe to use`,`The battery ${i} is not safe to use`],
      [`${alice} defeated ${bob} in the final`,`${bob} defeated ${alice} in the final`],
      [`The north door ${i} is locked`,`The south door ${i} is locked`],
      [`A dose of ${dose}.5 mg`,`A dose of ${dose}5 mg`],
      [`La dosis es ${dose} gramos`,`La dosis es ${other} gramos`],
      [`The value is ${dose}`,`The value is ${dose}%`],
      [`Example ${i} uses C`,`Example ${i} uses C++`],
      [`A reaction ${i}`,`A reactor ${i}`],
      [`The delta is -${dose} units`,`The delta is +${dose} units`],
    ];
    for(const pair of pairs)for(const lines of [pair,[...pair].reverse()]){
      assert.deepEqual(recognizedScreenLines(data(lines)),lines,JSON.stringify(lines));
    }
  }
});

test('4,000 generated fragment and duplicate layouts retain the fuller ordered text',()=>{
  for(let i=0;i<1000;i++){
    const short=`Chemical reactions ${i}`,full=`Chemical reactions ${i} trap lithium in batteries`;
    for(const lines of [[short,full],[full,short],[full,full.toUpperCase()],[full,full.replaceAll(' ','   ')]]){
      assert.deepEqual(mergeScreenLines(lines),[full]);
    }
  }
  const bounded=mergeScreenLines(Array.from({length:1000},(_,i)=>`Unique caption number ${i}`));
  assert.ok(bounded.length<=40);assert.ok(bounded.join('').length<=2000);
  assert.deepEqual(mergeScreenLines(['Ｃａｐｔｉｏｎ text','caption text']),['Ｃａｐｔｉｏｎ text']);
});

test('1,000 cancellation timelines discard late work and preserve the next OCR job',async()=>{
  const phases=['load','subtitle parameters','subtitle pixels','full parameters','full pixels'];
  for(const phase of phases)for(let i=0;i<200;i++){
    let unblock,loads=0,terminated=0;
    const gate=new Promise(resolve=>unblock=resolve),calls=[],states=[];
    const worker=index=>{
      let parameters=0,reads=0;
      const step=async name=>{if(index===0){calls.push(name);if(phase===name)await gate;}};
      return {
        async setParameters(){await step(++parameters===1?'subtitle parameters':'full parameters');},
        async recognize(){await step(++reads===1?'subtitle pixels':'full pixels');return {data:data([index===0?'Stale canceled caption':`Current caption ${i}`])};},
        terminate(){terminated++;},
      };
    };
    const model=createOcrModel(state=>states.push(state.status),async()=>{
      const index=loads++,loaded={worker:worker(index),PSM:{SINGLE_BLOCK:6,AUTO:3}};
      if(index===0&&phase==='load')await gate;
      return loaded;
    });
    try{
      const first=model.read('old',1280,720),canceled=assert.rejects(first,/stopped/);
      await flush();const before=calls.length;model.release();await canceled;
      assert.equal((await model.read('new',1280,720)).text,`Current caption ${i}`);
      unblock();await flush();
      assert.equal(calls.length,before,`${phase}: canceled worker scheduled more OCR`);
      assert.equal(states.filter(state=>state==='ready').length,1);
      assert.equal(states.filter(state=>state==='error').length,0);
      assert.equal(loads,2);
    }finally{unblock();model.release();await flush();}
    assert.equal(terminated,2,`${phase}: each worker must be released once`);
  }
});
