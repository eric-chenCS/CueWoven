import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../lib/scene-policy.js';
const P=globalThis.__recallScenePolicy;
const frame=shade=>new Uint8ClampedArray(P.WIDTH*P.HEIGHT*4).fill(shade);
test('change probes reject static pictures, small codec noise and isolated moving pixels',()=>{
 assert.equal(P.changedFrame(null,frame(0)),false);assert.equal(P.changedFrame(frame(40),frame(40)),false);assert.equal(P.changedFrame(frame(40),frame(55)),false);const tiny=frame(40);for(let i=0;i<8;i++)tiny[i*4]=240;assert.equal(P.changedFrame(frame(40),tiny),false);
});
test('change probes detect both broad cuts and a localized event between snapshots',()=>{
 assert.equal(P.changedFrame(frame(0),frame(200)),true);const local=frame(0);for(let y=18;y<27;y++)for(let x=24;x<36;x++)local[(y*P.WIDTH+x)*4]=200;assert.equal(P.changedFrame(frame(0),local),true);
});
test('the shared extra-frame budget bounds bursts and recovers at the rolling minute',()=>{
 const budget=P.createBudget();for(let i=0;i<6;i++){assert.equal(budget.allows(1000+i),true);budget.record(1000+i);}assert.equal(budget.allows(2000),false);assert.equal(budget.retryAfter(2000),59000);assert.equal(budget.allows(61000),true);
});
