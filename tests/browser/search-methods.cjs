const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),{pathToFileURL}=require('url');
const source=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..');
const fixture=require(path.join(source,'tests/browser/web-fixture.cjs'));
if(!process.env.RECALL_METHOD_MODELS||!process.env.RECALL_MODEL_DIR)throw Error('Set RECALL_METHOD_MODELS and RECALL_MODEL_DIR to the verified local model directories.');
const output=process.env.RECALL_REPORT_DIR||path.resolve('outputs');fs.mkdirSync(output,{recursive:true});
const qtile=(xs,p)=>{const a=[...xs].sort((a,b)=>a-b);return a[Math.floor((a.length-1)*p)]||0;};
const distinct=hits=>{const seen=new Set();return hits.filter(h=>!seen.has(h.videoId)&&seen.add(h.videoId));};
function rrf(lists){const sums=new Map(),hits=new Map();for(const list of lists)for(const [i,h]of list.entries()){sums.set(h.videoId,(sums.get(h.videoId)||0)+1/(60+i+1));if(!hits.has(h.videoId))hits.set(h.videoId,h);}return [...hits.values()].sort((a,b)=>sums.get(b.videoId)-sums.get(a.videoId));}
const compact=hits=>hits.slice(0,5).map(h=>({videoId:h.videoId,score:h.score,match:h.match,start:h.start}));
const names=['baseline','rewrite-only','rewrite-rrf','keywords-rrf','clauses-rrf','bm25-rrf','clue-coverage','crossencoder-10','crossencoder-rrf','crossencoder-gated','crossencoder-checked','agreement-check','crossencoder-related','crossencoder-related-checked','crossencoder-weak','crossencoder-weak-checked'];
(async()=>{
 const load=relative=>import(pathToFileURL(path.join(source,relative)).href);
 const [stress,fresh,guards,lang,search,scene]=await Promise.all(['tests/fixtures/search-stress.mjs','tests/fixtures/search-fresh.mjs','tests/fixtures/search-method-guards.mjs','lib/search-language.js','lib/search.js','lib/scenes.js'].map(load));
 const id=v=>v.padEnd(11,'_').slice(0,11),root=fs.mkdtempSync(path.join(process.env.RECALL_TEST_ROOT||os.tmpdir(),'recall-method-root-'));
 fs.cpSync(source,root,{recursive:true,filter:p=>!path.relative(source,p).split(path.sep).some(x=>['.git','node_modules'].includes(x))&&!p.endsWith('.zip')});
 fs.cpSync(process.env.RECALL_METHOD_MODELS,path.join(root,'test-models'),{recursive:true,filter:p=>!p.endsWith('.onnx')||p.endsWith('_quantized.onnx')});process.env.RECALL_EXTENSION=root;
 const f=await fixture(),errors=[],rows=[],pilot=[];f.context.on('weberror',e=>errors.push(e.error().message));
 let ceLoad=0,rewriteLoad=0;
 const runSearch=async query=>{const begin=performance.now(),r=await f.send({target:'offscreen',type:'search',query,perVideo:2,limit:40});if(r.error)throw Error(r.error);return{hits:r.results||[],ms:performance.now()-begin};};
 const record=(hits,expected,ms)=>{const position=hits.findIndex(h=>expected.includes(h.videoId));return{top1:expected.length?position===0:hits.length===0,top5:expected.length?position>=0&&position<5:null,top20:expected.length?position>=0:null,ms,hits:compact(hits)};};
 const quoted=q=>/["“”]/.test(q);
 const rewrite=q=>quoted(q)?q:q.replace(/^i (?:can'?t|cannot) remember the title but\s+/i,'').replace(/^(?:can|could) you (?:please )?(?:find|show)(?: me)? (?:a |the )?(?:clip|video) (?:about|where (?:they|he|she) mentioned)\s+/i,'').replace(/^(?:a|that|the|this) (?:video|clip) (?:of (?:the )?speaker )?(?:talking|speaking) about\s+/i,'').replace(/^(?:a|that|the|this) (?:video|clip) about\s+/i,'').trim()||q;
 let corpus=[...stress.videos];
 const safeRewrite=(q,r)=>{if(quoted(q))return q;const terms=search.prepareQuery(q).terms,out=search.prepareQuery(r).terms,numbers=terms.filter(t=>/^\d+$/.test(t)),next=out.filter(t=>/^\d+$/.test(t));if(!r.trim()||r.length>350||out.length<Math.min(2,terms.length)||numbers.join('|')!==next.join('|'))return q;
  const p=search.phraseText(q);for(const channel of new Set(corpus.map(v=>v.channel))){const name=search.phraseText(channel);if(name.length>2&&p.includes(name)&&!search.phraseText(r).includes(name))return q;}return r;};
 async function seed(videos){for(const v of videos){const r=await f.send({target:'offscreen',type:'index',method:'controlled-test',video:{videoId:id(v.videoId),title:v.title,channel:v.channel,watchedAt:Date.now()},segments:v.chunks.map(c=>({...c,dur:8}))});if(r.error)throw Error(r.error);}}
 function lexicalOrder(q,base,raw){
  const terms=search.prepareQuery(q).terms,docs=base.map(h=>({hit:h,words:lang.wordText(raw.filter(x=>x.videoId===h.videoId).slice(0,2).map(x=>x.text).join(' ')).split(' ')})),N=docs.length,avg=docs.reduce((s,d)=>s+d.words.length,0)/Math.max(1,N);
  const df=new Map(terms.map(t=>[t,docs.filter(d=>d.words.includes(t)).length]));
  const scored=docs.map(d=>{let score=0,cover=0;for(const t of terms){const tf=d.words.filter(w=>w===t).length;if(tf){const idf=Math.log(1+(N-(df.get(t)||0)+.5)/((df.get(t)||0)+.5));score+=idf*tf*2.2/(tf+1.2*(.25+.75*d.words.length/Math.max(1,avg)));cover++;}}return{hit:d.hit,score,coverage:terms.length?cover/terms.length:0};});
  return{bm25:scored.filter(d=>d.score>0).sort((a,b)=>b.score-a.score).map(d=>d.hit),coverage:scored.sort((a,b)=>(b.hit.score+.1*b.coverage)-(a.hit.score+.1*a.coverage)).map(d=>d.hit)};
 }
 try{
 await f.enable();await seed(stress.videos);
 await f.options.evaluate(async base=>{const tf=await import(base+'/vendor/transformers.bundle.js');tf.env.allowLocalModels=true;tf.env.allowRemoteModels=false;tf.env.localModelPath=base+'/test-models/';tf.env.useBrowserCache=false;tf.env.backends.onnx.wasm.numThreads=1;tf.env.backends.onnx.wasm.wasmPaths=base+'/vendor/';window.methodTF=tf;},f.base);
 rewriteLoad=await f.options.evaluate(async()=>{const t=performance.now();window.rewriter=await methodTF.pipeline('text2text-generation','Xenova/flan-t5-small',{dtype:'q8',device:'wasm'});return performance.now()-t;});
 const pilotCases=[...stress.queries.filter(q=>q.group==='user-transcript'),...stress.queries.filter(q=>q.group==='hard-paraphrase').slice(0,16),...guards.queries.filter(q=>q.group==='guard-quote').slice(0,4),...guards.queries.filter(q=>q.group==='guard-contrast').slice(0,8),...guards.queries.filter(q=>q.group==='guard-number').slice(0,4)];assert.equal(pilotCases.length,48);
 for(const [i,q]of pilotCases.entries()){
  const expected=q.expected.map(id),base=await runSearch(q.query),original=distinct(base.hits);const row={query:q.query,group:q.group,expected,baseline:record(original,expected,base.ms),prompts:{}};
  for(const style of ['search','paraphrase']){
   const prompt=style==='search'?'Rewrite this memory as a short search query. Preserve the meaning, names and numbers. Memory: '+q.query+' Search query:':'Paraphrase this sentence without changing its meaning or adding facts: '+q.query;
   const r=quoted(q.query)?{text:q.query,ms:0}:await f.options.evaluate(async prompt=>{const t=performance.now(),out=await rewriter(prompt,{max_new_tokens:48,do_sample:false});return{text:out[0].generated_text,ms:performance.now()-t};},prompt);
   const safe=safeRewrite(q.query,r.text),alt=safe===q.query?base:await runSearch(safe),altHits=distinct(alt.hits),ms=base.ms+r.ms+(safe===q.query?0:alt.ms);
   row.prompts[style]={raw:r.text,used:safe,guarded:safe!==r.text,generationMs:r.ms,rewrite:record(altHits,expected,ms),fusion:record(rrf([original,altHits]),expected,ms)};
  }
  pilot.push(row);if((i+1)%8===0)console.log('REWRITE_PILOT',i+1+'/48');
 }
 await f.options.evaluate(async()=>{await rewriter.dispose();delete window.rewriter;});
 fs.writeFileSync(path.join(output,'cuewoven-rewriter-pilot.json'),JSON.stringify({rewriteLoad,rows:pilot},null,2));
 console.log('REWRITE_PILOT_SUMMARY',JSON.stringify({baseline:pilot.filter(r=>r.baseline.top1).length,total:pilot.length,methods:Object.fromEntries(['search','paraphrase'].map(k=>[k,{rewrite:pilot.filter(r=>r.prompts[k].rewrite.top1).length,fusion:pilot.filter(r=>r.prompts[k].fusion.top1).length,guarded:pilot.filter(r=>r.prompts[k].guarded).length,p50Ms:qtile(pilot.filter(r=>r.prompts[k].generationMs).map(r=>r.prompts[k].generationMs),.5),p95Ms:qtile(pilot.filter(r=>r.prompts[k].generationMs).map(r=>r.prompts[k].generationMs),.95)}]))}));
 ceLoad=await f.options.evaluate(async()=>{const t=performance.now();window.reranker=await methodTF.pipeline('text-classification','Xenova/ms-marco-MiniLM-L-6-v2',{dtype:'q8',device:'wasm'});window.cross=reranker.model;window.crossTok=reranker.tokenizer;return performance.now()-t;});
 // Fixed policies: top-10 reranking, rank fusion (k=60), existing .04 near-tie gate,
 // optional logit margin >=1, and agreement with original+rewrite fusion.
 for(const phase of [{name:'stress',queries:[...stress.queries,...guards.queries]},{name:'fresh',queries:fresh.queries}]){
  if(phase.name==='fresh'){corpus.push(...fresh.videos);await seed(fresh.videos);}
  for(const q of phase.queries){
   const expected=q.expected.map(id),b=await runSearch(q.query),base=distinct(b.hits).slice(0,20),methods={baseline:record(base,expected,b.ms)},text=quoted(q.query)?q.query:safeRewrite(q.query,rewrite(q.query)),kw=quoted(q.query)?q.query:safeRewrite(q.query,search.prepareQuery(q.query).terms.join(' '));
   const rq=text===q.query?b:await runSearch(text),kq=kw===q.query?b:kw===text?rq:await runSearch(kw),ranks=distinct(rq.hits).slice(0,20),keywordRanks=distinct(kq.hits).slice(0,20),fused=rrf([base,ranks]);
   methods['rewrite-only']=record(ranks,expected,b.ms+(text===q.query?0:rq.ms));methods['rewrite-rrf']=record(fused,expected,methods['rewrite-only'].ms);
   methods['keywords-rrf']=record(rrf([base,keywordRanks]),expected,b.ms+(kw===q.query?0:kq.ms));
   const clauses=quoted(q.query)?[]:q.query.split(/\s+(?:and|also)\s+/i).filter(s=>search.prepareQuery(s).terms.length>=2).slice(0,2),clauseLists=[base];let clauseMs=0;
   if(clauses.length===2)for(const clause of clauses){const r=await runSearch(clause);clauseLists.push(distinct(r.hits).slice(0,20));clauseMs+=r.ms;}
   methods['clauses-rrf']=record(rrf(clauseLists),expected,b.ms+clauseMs);
   const lexBegin=performance.now(),lex=lexicalOrder(q.query,base,b.hits),lexMs=performance.now()-lexBegin;
   methods['bm25-rrf']=record(quoted(q.query)?base:rrf([base,lex.bm25]),expected,b.ms+lexMs);methods['clue-coverage']=record(quoted(q.query)?base:lex.coverage,expected,b.ms+lexMs);
   const candidates=base.slice(0,10),docs=candidates.map(h=>[h.title,h.channel,...b.hits.filter(x=>x.videoId===h.videoId).slice(0,2).map(x=>x.text)].filter(Boolean).join('\n'));
   const ce=docs.length?await f.options.evaluate(async({query,docs})=>{const t=performance.now(),features=crossTok(docs.map(()=>query),{text_pair:docs,padding:true,truncation:true,max_length:256}),r=await cross(features);return{scores:Array.from(r.logits.data),ms:performance.now()-t};},{query:q.query,docs}):{scores:[],ms:0};
   assert.equal(ce.scores.length,candidates.length);assert.ok(ce.scores.every(Number.isFinite),'reranker returned invalid scores');
   const cePairs=candidates.map((hit,i)=>({hit,logit:ce.scores[i]})).sort((a,b)=>b.logit-a.logit),ceRanks=[...cePairs.map(x=>x.hit),...base.slice(10)],ceRrf=[...rrf([candidates,cePairs.map(x=>x.hit)]),...base.slice(10)],gate=!quoted(q.query)&&base.length>1&&base[0].score-base[1].score<.04,margin=cePairs.length>1?cePairs[0].logit-cePairs[1].logit:0;
   methods['crossencoder-10']=record(ceRanks,expected,b.ms+ce.ms);methods['crossencoder-rrf']=record(ceRrf,expected,b.ms+ce.ms);
   methods['crossencoder-gated']=record(gate?ceRanks:base,expected,b.ms+(gate?ce.ms:0));methods['crossencoder-checked']=record(gate&&margin>=1?ceRanks:base,expected,b.ms+(gate?ce.ms:0));
   methods['agreement-check']=record(gate&&margin>=1&&ceRanks[0]?.videoId===fused[0]?.videoId?ceRanks:base,expected,b.ms+(gate?ce.ms+(text===q.query?0:rq.ms):0));
   const related=base[0]?.match==='related',weak=!scene.hasRelevantText(base);
   for(const [label,allowed,checked]of [['crossencoder-related',related,false],['crossencoder-related-checked',related,true],['crossencoder-weak',weak,false],['crossencoder-weak-checked',weak,true]])methods[label]=record(gate&&allowed&&(!checked||margin>=1)?ceRanks:base,expected,b.ms+(gate&&allowed?ce.ms:0));
   rows.push({id:rows.length+1,phase:phase.name,query:q.query,group:q.group,expected,rewritten:text,keywords:kw,clauses,ceMs:ce.ms,gate,weak,margin,ce:cePairs.map(x=>({videoId:x.hit.videoId,logit:x.logit})),methods});
   if(rows.length%50===0){console.log('METHOD_PROGRESS',rows.length+'/1160');fs.writeFileSync(path.join(output,'cuewoven-method-progress.json'),JSON.stringify({completed:rows.length,total:1160}));}
  }
 }
 await f.options.evaluate(async()=>{await cross.dispose();delete window.cross;});
 const summary={};for(const name of names){const m=rows.map(r=>r.methods[name]);summary[name]={total:rows.length,known:rows.filter(r=>r.expected.length).length,top1:m.filter(x=>x.top1).length,knownTop1:rows.filter(r=>r.expected.length&&r.methods[name].top1).length,knownTop5:rows.filter(r=>r.expected.length&&r.methods[name].top5).length,p50Ms:qtile(m.map(x=>x.ms),.5),p95Ms:qtile(m.map(x=>x.ms),.95),gains:rows.filter(r=>!r.methods.baseline.top1&&r.methods[name].top1).length,losses:rows.filter(r=>r.methods.baseline.top1&&!r.methods[name].top1).length,guards:rows.filter(r=>r.group.startsWith('guard-')&&r.methods[name].top1).length,fresh:rows.filter(r=>r.phase==='fresh'&&r.methods[name].top1).length,user:rows.filter(r=>r.group==='user-transcript'&&r.methods[name].top1).length};}
 const report={browser:await f.context.browser().version(),ceModel:'Xenova/ms-marco-MiniLM-L-6-v2',rewriteModel:'Xenova/flan-t5-small',ceLoadMs:ceLoad,rewriteLoadMs:rewriteLoad,methodology:'Original 1000 plus 40 frozen quote/contrast/number/channel guards on 41 videos; 120 existing validation cases on 61 videos. Actual current MiniLM and WASM cross-encoder, one CPU thread. Learned rewrites screened separately on 48 challenging cases with two fixed prompts. No queries sent to hosted inference. Latencies project each policy independently from measured baseline, extra-query and model stages; shared caches and repeated variants apply. These are controlled correlated cases, not independent real-user accuracy.',policies:{rrfK:60,topVideos:10,passagesPerVideo:2,nearTie:.04,checkedLogitMargin:1,coverageBonus:.1,maxPairTokens:256},summary,errors,rows,pilot};
 fs.writeFileSync(path.join(output,'cuewoven-search-methods.json'),JSON.stringify(report,null,2));console.log('METHOD_SUMMARY',JSON.stringify({...report,rows:undefined,pilot:undefined}));assert.equal(rows.length,1160);assert.deepEqual(errors,[]);console.log('METHOD_EVALUATION_COMPLETED: inspect gains and regressions; not every method is suitable for deployment');
 }finally{await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
