import {existsSync,mkdirSync,mkdtempSync,writeFileSync,createWriteStream} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';

// A maintained regression set, not every historical experiment in tests/browser.
export const browserCases={
  'transcript-dom':[], 'release-ui':[], 'transcript-label-refresh':['text'], 'late-captions':['text'], 'speech-caption-cancel':[],
  'cuewoven-branding':['text'], 'gray-theme':[], 'security-hardening':['text'],
  'video-overflow':['text'], 'single-video':[], 'capture-progress':['text'],
  'text-worker-recovery':['text'], 'scene-default':['text','vision'], 'video-scope':['text','vision'],
};
const assets={
  text:['config.json','tokenizer.json','tokenizer_config.json','onnx/model_quantized.onnx'].map(file=>'Xenova/all-MiniLM-L6-v2/'+file),
  vision:['config.json','preprocessor_config.json','tokenizer.json','tokenizer_config.json','onnx/text_model_quantized.onnx','onnx/vision_model_quantized.onnx'].map(file=>'Xenova/clip-vit-base-patch32/'+file),
};
export function missingAssets(name,directory){
  if(!Object.hasOwn(browserCases,name))throw Error('Unknown regression: '+name);
  return directory?browserCases[name].flatMap(kind=>assets[kind]).filter(file=>!existsSync(path.join(directory,file))):[];
}
export const reportExit=rows=>rows.some(row=>row.status==='failed')?1:rows.some(row=>row.status==='blocked')?2:0;

async function main(){
  const names=process.argv.slice(2);
  if(!names.length)names.push(...Object.keys(browserCases));
  for(const name of names)if(!Object.hasOwn(browserCases,name))throw Error('Unknown regression: '+name+'. Supported: '+Object.keys(browserCases).join(', '));
  const repo=fileURLToPath(new URL('../',import.meta.url));
  const base=process.env.RECALL_REPORT_DIR||tmpdir();mkdirSync(base,{recursive:true});
  const output=mkdtempSync(path.join(base,'cuewoven-checks-'));
  let environmentError;
  try{
    const {chromium}=createRequire(import.meta.url)(process.env.RECALL_PLAYWRIGHT||'playwright');
    const executable=process.env.RECALL_BROWSER||chromium.executablePath();
    if(!existsSync(executable))throw Error('Browser executable missing: '+executable);
  }catch(error){environmentError=error.message;}
  const results=[];
  for(const name of names){
    const missing=missingAssets(name,process.env.RECALL_MODEL_DIR);
    const runtimeMissing=name!=='transcript-dom'&&!existsSync(path.join(process.env.RECALL_EXTENSION||repo,'vendor/transformers.bundle.js'));
    const reason=environmentError||(runtimeMissing?'Browser runtime missing; run pnpm run vendor':missing.length?'Missing local model files: '+missing.join(', '):null);
    let row;
    if(reason)row={test:name,status:'blocked',reason};
    else{
      const started=Date.now(),log=path.join(output,name+'.log'),stream=createWriteStream(log);
      const outcome=await new Promise(resolve=>{
        const child=spawn(process.execPath,[path.join(repo,'tests/browser',name+'.cjs')],{cwd:repo,env:{...process.env,RECALL_REPORT_DIR:output,RECALL_SCREENSHOT_DIR:output},stdio:['ignore','pipe','pipe']});
        child.stdout.pipe(stream,{end:false});child.stderr.pipe(stream,{end:false});
        let error;child.on('error',value=>{error=value.message;});
        child.on('close',(code,signal)=>stream.end(()=>resolve({code,signal,error})));
      });
      row={test:name,status:outcome.code===0?'passed':'failed',...outcome,ms:Date.now()-started,log};
    }
    results.push(row);writeFileSync(path.join(output,'results.json'),JSON.stringify({scope:'maintained browser regressions',results},null,2));
    console.log(row.status.toUpperCase()+': '+name+(row.reason?' — '+row.reason:''));
  }
  console.log('Report: '+path.join(output,'results.json'));
  process.exitCode=reportExit(results);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=2;});
