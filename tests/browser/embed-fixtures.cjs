// Regenerates tests/fixtures/confusable-vectors.json with the extension's own transformers.js.
// No network: RECALL_MODEL_DIR must contain Xenova/all-MiniLM-L6-v2/{config.json,tokenizer.json,
// tokenizer_config.json,onnx/model.onnx}. Uses the full-precision weights; the shipped extension
// uses the 8-bit copy, which scores very slightly differently.
// usage: RECALL_MODEL_DIR=... node tests/browser/embed-fixtures.cjs
const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright');const fs=require('fs'),path=require('path'),os=require('os'),{pathToFileURL}=require('url');
const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..'),models=process.env.RECALL_MODEL_DIR;
if(!models)throw Error('Set RECALL_MODEL_DIR to a folder containing Xenova/all-MiniLM-L6-v2.');
const FILLER=['um','so','you know','like','uh','basically','right'],PAD=['okay','so','anyway','let me show you','alright','moving on'];
// Auto-caption version: lowercase, no punctuation, filler words, ~7-word lines every 3 s, then Recall's chunker.
function captions(videos,chunkTranscript){
 let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 return videos.map(v=>{
  const lines=[];
  v.chunks.forEach((c,ci)=>{
   const words=c.text.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu,' ').split(/\s+/).filter(Boolean),out=[];
   words.forEach(w=>{out.push(w);if(rnd()<0.12)out.push(FILLER[Math.floor(rnd()*FILLER.length)]);});
   for(let i=0;i<out.length;i+=7)lines.push({start:c.start+(i/7)*3,dur:3,text:out.slice(i,i+7).join(' ')});
   lines.push({start:c.start+Math.ceil(out.length/7)*3,dur:3,text:PAD[ci%PAD.length]+' '+PAD[(ci+2)%PAD.length]});
  });
  return {videoId:v.videoId,title:v.title,channel:v.channel,chunks:chunkTranscript(lines).map(c=>({start:c.start,end:c.end,text:c.text}))};
 });
}
const pack=vectors=>Buffer.from(vectors.flatMap(v=>v.map(x=>Math.max(-127,Math.min(127,Math.round(x*127)))&255))).toString('base64');
(async()=>{
 const imp=f=>import(pathToFileURL(path.join(root,f)).href);
 const [{embeddingText},{chunkTranscript},original,confusable]=await Promise.all([imp('lib/embedding-migration.js'),imp('lib/chunk.js'),imp('tests/fixtures/retrieval.mjs'),imp('tests/fixtures/confusable.mjs')]);
 const texts=[],seen=new Set(),add=t=>{if(!seen.has(t)){seen.add(t);texts.push(t);}};
 for(const set of [original,confusable]){for(const v of set.videos)for(const c of v.chunks)add(embeddingText(v,c.text));for(const q of set.queries)add(Array.isArray(q)?q[0]:q.query);}
 const caption=captions(confusable.videos,chunkTranscript),captionTexts=caption.flatMap(v=>v.chunks.map(c=>c.text));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'recall-embed-')),copy=path.join(dir,'ext');
 fs.cpSync(root,copy,{recursive:true,filter:s=>!/node_modules|\.git/.test(path.relative(root,s))});
 fs.cpSync(models,path.join(copy,'test-models'),{recursive:true});
 const context=await chromium.launchPersistentContext(path.join(dir,'profile'),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${copy}`,`--load-extension=${copy}`]});
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),page=await context.newPage();
  await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/options/options.html`);
  const [vectors,captionVectors]=await page.evaluate(async lists=>{
   const {pipeline,env}=await import(chrome.runtime.getURL('vendor/transformers.bundle.js'));
   env.allowLocalModels=true;env.allowRemoteModels=false;env.localModelPath=chrome.runtime.getURL('test-models/');env.useBrowserCache=false;
   env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.wasmPaths=chrome.runtime.getURL('vendor/');
   const extractor=await pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{dtype:'fp32',device:'wasm'});
   const run=async texts=>{const out=[];for(let i=0;i<texts.length;i+=16){const t=await extractor(texts.slice(i,i+16),{pooling:'mean',normalize:true}),d=t.dims.at(-1);for(let b=0;b<t.dims[0];b++)out.push(Array.from(t.data.slice(b*d,(b+1)*d)));}return out;};
   return [await run(lists[0]),await run(lists[1])];
  },[texts,captionTexts]);
  const data={note:'all-MiniLM-L6-v2 (fp32 weights) mean-pooled, normalized vectors, int8 (x127). Regenerate with tests/browser/embed-fixtures.cjs.',dim:384,texts,vectors:pack(vectors),captions:{videos:caption,vectors:pack(captionVectors)}};
  const out=process.env.RECALL_VECTORS_OUT||path.join(root,'tests/fixtures/confusable-vectors.json');
  fs.writeFileSync(out,JSON.stringify(data));console.log('wrote',out,texts.length,'texts,',captionTexts.length,'caption chunks');
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
