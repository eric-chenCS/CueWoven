import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {missingAssets,reportExit} from '../scripts/browser-tests.mjs';

test('browser preflight distinguishes incomplete local model fixtures from runnable checks',()=>{
  const root=mkdtempSync(path.join(tmpdir(),'cuewoven-assets-'));
  try{
    assert.equal(missingAssets('transcript-dom',root).length,0);
    assert.equal(missingAssets('scene-default').length,0,'without local overrides browser tests may download models');
    assert.throws(()=>missingAssets('../untrusted',root),/Unknown regression/);
    const text=missingAssets('transcript-label-refresh',root);assert.equal(text.length,4);
    for(const file of text){mkdirSync(path.dirname(path.join(root,file)),{recursive:true});writeFileSync(path.join(root,file),'fixture');}
    assert.deepEqual(missingAssets('transcript-label-refresh',root),[]);
    const visual=missingAssets('scene-default',root);assert.equal(visual.length,6);assert.ok(visual.every(file=>file.startsWith('Xenova/clip-vit-base-patch32/')));
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('browser failures take precedence and blocked checks never count as a clean pass',()=>{
  assert.equal(reportExit([{status:'passed'}]),0);
  assert.equal(reportExit([{status:'passed'},{status:'blocked'}]),2);
  assert.equal(reportExit([{status:'blocked'},{status:'failed'}]),1);
});
