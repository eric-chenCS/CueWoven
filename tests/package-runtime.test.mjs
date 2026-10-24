import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkRuntime} from '../scripts/check-runtime.mjs';

test('packaging checks matching ONNX loaders/binaries and every local OCR runtime',()=>{
  const root=mkdtempSync(join(tmpdir(),'cuewoven-runtime-'));
  const files=['vendor/transformers.bundle.js','vendor/ort-wasm-simd-threaded.jsep.mjs','vendor/ort-wasm-simd-threaded.jsep.wasm','vendor/ocr/ocr.bundle.js','vendor/ocr/worker.min.js','vendor/ocr/eng.traineddata',...['','simd-','relaxedsimd-'].map(kind=>'vendor/ocr/tesseract-core-'+kind+'lstm.wasm.js')];
  try{
    mkdirSync(join(root,'vendor/ocr'),{recursive:true});
    for(const file of files)writeFileSync(join(root,file),file.endsWith('.wasm')?Buffer.from([0,97,115,109,1,0,0,0]):file.endsWith('transformers.bundle.js')?'ort-wasm-simd-threaded.jsep.mjs ort-wasm-simd-threaded.jsep.wasm':'fixture');
    assert.deepEqual(checkRuntime(root),files);
    for(const file of files.slice(1)){
      const target=join(root,file);writeFileSync(target,'');assert.throws(()=>checkRuntime(root),/Missing or empty runtime file/);
      unlinkSync(target);assert.throws(()=>checkRuntime(root),/Missing or empty runtime file/);
      writeFileSync(target,file.endsWith('.wasm')?Buffer.from([0,97,115,109,1,0,0,0]):'fixture');
    }
    writeFileSync(join(root,'vendor/ocr/eng.traineddata.gz'),'gz');assert.throws(()=>checkRuntime(root),/compressed files/);unlinkSync(join(root,'vendor/ocr/eng.traineddata.gz'));
    writeFileSync(join(root,files[2]),'not wasm');assert.throws(()=>checkRuntime(root),/Invalid WASM/);
    writeFileSync(join(root,files[0]),'unrecognized runtime');assert.throws(()=>checkRuntime(root),/Cannot identify/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
