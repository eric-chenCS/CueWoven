import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCaptureHold} from '../lib/capture-hold.js';
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
test('library changes drain captures, active searches and warmup before writing',async()=>{
  const frame=deferred(),query=deferred(),warmup=deferred();let canceled=0,wrote=false;
  const hold=createCaptureHold({pending:()=>[frame.promise,query.promise,warmup.promise,null],cancel:()=>canceled++});
  const change=hold.run(async()=>{wrote=true;return 'saved';});
  assert.equal(hold.held(),true);assert.equal(canceled,1);frame.resolve();query.resolve();await Promise.resolve();assert.equal(wrote,false);
  warmup.resolve();assert.equal(await change,'saved');assert.equal(hold.held(),false);
});
test('restore reserves exclusivity before waiting for an in-flight frame',async()=>{
  const frame=deferred(),work=deferred();const hold=createCaptureHold({pending:()=>[frame.promise]});
  const restore=hold.run(()=>work.promise,{restore:true});
  await assert.rejects(hold.run(()=>assert.fail('clear must not run')),/backup restore/);
  frame.resolve();await Promise.resolve();await assert.rejects(hold.run(()=>assert.fail('delete must not run')),/backup restore/);
  work.resolve();await restore;assert.equal(hold.held(),false);
});
test('a pending delete also excludes another delete or restore instead of overlapping',async()=>{
  const frame=deferred(),hold=createCaptureHold({pending:()=>[frame.promise]});const remove=hold.run(async()=>{});
  await assert.rejects(hold.run(()=>assert.fail('restore must not run'),{restore:true}),/current library change/);
  await assert.rejects(hold.run(()=>assert.fail('delete must not run')),/current library change/);
  frame.resolve();await remove;assert.equal(await hold.run(async()=>'next',{restore:true}),'next');
});
test('capture errors do not block writes and action failures always release the hold',async()=>{
  const hold=createCaptureHold({pending:()=>[Promise.reject(Error('OCR canceled'))]});
  assert.equal(await hold.run(async()=>'deleted'),'deleted');await assert.rejects(hold.run(async()=>{throw Error('disk full');}),/disk full/);assert.equal(hold.held(),false);
  const cancel=createCaptureHold({cancel:()=>{throw Error('cancel failed');}});await assert.rejects(cancel.run(()=>{}),/cancel failed/);assert.equal(cancel.held(),false);
});
