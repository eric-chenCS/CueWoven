const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),{execFileSync}=require('child_process');
const {pathToFileURL}=require('url');
const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..');
(async()=>{
 const fixture=await import(pathToFileURL(path.resolve(__dirname,'../fixtures/retrieval.mjs')));
 const {videos,queries}=fixture,rows=videos.flatMap(video=>video.chunks.map(chunk=>({...chunk,videoId:video.videoId,title:video.title,channel:video.channel,method:video.method})));
 const signature=crypto.createHash('sha256').update(JSON.stringify({videos,queries})).digest('hex');
 const cache=process.env.RECALL_RETRIEVAL_VECTORS;let embedded;
 if(cache&&fs.existsSync(cache)){embedded=JSON.parse(fs.readFileSync(cache,'utf8'));if(embedded.signature!==signature)throw Error('Retrieval fixture changed; regenerate the vector cache');}
 else {
  const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright');
  const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-retrieval-eval-')),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
  try {
   const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),page=await context.newPage();await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/options/options.html`);
   embedded=await page.evaluate(async({rows,queries})=>{
    const {pipeline,env}=await import(chrome.runtime.getURL('vendor/transformers.bundle.js'));env.allowLocalModels=false;env.useBrowserCache=true;env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.wasmPaths=chrome.runtime.getURL('vendor/');
    const output={};
    for(const model of ['Xenova/all-MiniLM-L6-v2','Xenova/bge-small-en-v1.5']){
     const start=performance.now(),extractor=await pipeline('feature-extraction',model,{dtype:'q8',device:'wasm'});
     const recipes={withTitle:rows.map(row=>row.method==='history-title'?`${row.title}. ${row.channel}`:`${row.title}. ${row.text}`),body:rows.map(row=>row.method==='history-title'?`${row.title}. ${row.channel}`:row.text),queries:queries.map(([q])=>q)};
     if(model.includes('bge'))recipes.queries=queries.map(([q])=>'Represent this sentence for searching relevant passages: '+q);
     const result={};for(const [name,texts] of Object.entries(recipes)){
      const list=[];for(let i=0;i<texts.length;i+=16){const tensor=await extractor(texts.slice(i,i+16),{pooling:model.includes('bge')?'cls':'mean',normalize:true});const dim=tensor.dims.at(-1);for(let b=0;b<tensor.dims[0];b++)list.push(Array.from(tensor.data.slice(b*dim,(b+1)*dim)))}result[name]=list;
     }result.elapsedMs=Math.round(performance.now()-start);output[model]=result;await extractor.dispose();
    }return output;
   },{rows,queries});embedded.signature=signature;if(cache)fs.writeFileSync(cache,JSON.stringify(embedded));
  }finally{await context.close()}
 }
 const loadRef=async ref=>{const code=execFileSync('git',['show',`${ref}:lib/search.js`],{encoding:'utf8'});return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))};
 const baseline=await loadRef('5fd3752'),branch=await loadRef('55e4f8c'),candidate=await import(pathToFileURL(path.join(root,'lib/search.js')));
 const records=new Map(videos.map(video=>[video.videoId,{...video,indexedAt:Date.now(),watchedAt:Date.now()}]));
 function evaluate(rank,vectors,recipe,minScore){
  const dim=384,index={dim,matrix:Float32Array.from(vectors[recipe].flat()),meta:rows};let videoHits=0,momentHits=0,mrr=0;const failures=[];
  queries.forEach(([query,id,start],i)=>{
   const results=rank(Float32Array.from(vectors.queries[i]),index,records,{query,limit:20,perVideo:1,...(minScore===undefined?{}:{minScore})});
   const rankIndex=results.findIndex(hit=>hit.videoId===id&&hit.start===start);
   if(results[0]?.videoId===id)videoHits++;if(rankIndex===0)momentHits++;if(rankIndex>=0)mrr+=1/(rankIndex+1);
   if(rankIndex!==0)failures.push({query,expected:{videoId:id,start},actual:results[0]?{videoId:results[0].videoId,start:results[0].start,score:results[0].score}:null});
  });return {queries:queries.length,videoHits,momentHits,mrr:Math.round(mrr/queries.length*1000)/1000,failures};
 }
 const mini=embedded['Xenova/all-MiniLM-L6-v2'],bge=embedded['Xenova/bge-small-en-v1.5'];
 const report={testedAt:new Date().toISOString(),fixtureHash:signature,baseline:evaluate(baseline.rank,mini,'withTitle'),maCopy:evaluate(branch.rank,mini,'body'),bodyOnly:evaluate(baseline.rank,mini,'body'),candidateMini:evaluate(candidate.rank,mini,'body'),candidateBge:evaluate(candidate.rank,bge,'body',0.4),modelBatchMs:{mini:mini.elapsedMs,bge:bge.elapsedMs}};
 if(process.env.RECALL_SCREENSHOT_DIR)fs.writeFileSync(path.join(process.env.RECALL_SCREENSHOT_DIR,'recall-retrieval-eval.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 require('assert/strict').equal(report.candidateMini.momentHits,queries.length,'Recall must retain every labeled moment on this fixed synthetic regression set');
})().catch(error=>{console.error(error);process.exitCode=1});
