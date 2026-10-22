import {readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';

export function checkRuntime(root) {
  const requireFile=file=>{
    try{const info=statSync(join(root,file));if(info.isFile()&&info.size>0)return;}
    catch{}
    throw Error(`Missing or empty runtime file: ${file}. Run "pnpm run setup" before packaging.`);
  };
  requireFile('vendor/transformers.bundle.js');
  const bundle=readFileSync(join(root,'vendor/transformers.bundle.js'),'utf8');
  const onnx=[...new Set(bundle.match(/ort-wasm[a-z0-9.-]*\.(?:wasm|mjs)/g)||[])];
  if(!onnx.some(file=>file.endsWith('.wasm'))||!onnx.some(file=>file.endsWith('.mjs')))throw Error('Cannot identify the bundled ONNX runtime files.');
  const files=['vendor/transformers.bundle.js',...onnx.map(file=>'vendor/'+file),
    'vendor/ocr/ocr.bundle.js','vendor/ocr/worker.min.js','vendor/ocr/eng.traineddata.gz',
    ...['','simd-','relaxedsimd-'].map(kind=>'vendor/ocr/tesseract-core-'+kind+'lstm.wasm.js')];
  files.forEach(requireFile);
  for(const file of files.filter(file=>file.endsWith('.wasm'))){
    if(!readFileSync(join(root,file)).subarray(0,4).equals(Buffer.from([0,97,115,109])))throw Error('Invalid WASM runtime file: '+file);
  }
  return files;
}
