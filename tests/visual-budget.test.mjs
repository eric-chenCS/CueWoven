import test from 'node:test';
import assert from 'node:assert/strict';
import {visualBudget} from '../lib/visual-budget.js';
test('visual search returns ready results and propagates model failure',async()=>{
  const result={results:[{articleImage:true}]};
  assert.equal(await visualBudget(Promise.resolve(result)),result);
  await assert.rejects(visualBudget(Promise.reject(Error('model unavailable'))),/model unavailable/);
});
test('a stalled visual model does not hold text results; late failure is handled',async()=>{
  let reject;
  const pending=new Promise((_resolve,fail)=>{reject=fail});
  assert.deepEqual(await visualBudget(pending,10),{results:[],pending:true});
  reject(Error('late model failure'));
  await new Promise(resolve=>setTimeout(resolve,10));
});
