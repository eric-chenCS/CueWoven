// Sequential real-browser baseline/candidate comparison, with no normal profile access.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),{pathToFileURL}=require('url'),os=require('os');
try{os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);}catch{}
const source=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..'),fixture=require('./web-fixture.cjs');
const id=value=>value.startsWith('h-')?'h'+crypto.createHash('sha256').update(value).digest('hex').slice(0,10):value.padEnd(11,'_').slice(0,11);
const out=process.env.RECALL_REPORT_DIR||os.tmpdir(),reports=[],watchedAt=Date.now();
const summary=rows=>{const known=rows.filter(r=>r.expected.length);return{total:rows.length,known:known.length,top1:known.filter(r=>r.top1).length,top5:known.filter(r=>r.top5).length,applied:rows.filter(r=>r.reranked).length};};
(async()=>{
 const [stress,fresh,guards,confirm,holdout,final]=await Promise.all(['search-stress.mjs','search-fresh.mjs','search-method-guards.mjs','search-method-confirm.mjs','search-rerank-holdout.mjs','search-rerank-final.mjs'].map(name=>import(pathToFileURL(path.join(source,'tests/fixtures',name)).href)));
 const ids=[...stress.videos,...fresh.videos,...holdout.videos,...final.videos].map(v=>id(v.videoId));assert.equal(new Set(ids).size,ids.length);
 const sets=[...(process.env.RECALL_RANK_BASELINE?[['baseline',process.env.RECALL_RANK_BASELINE]]:[]),['selective-ettin',source]];
 for(const [label,root]of sets){
  process.env.RECALL_EXTENSION=root;const f=await fixture(),rows=[],errors=[],downloads=[];
  f.context.on('weberror',e=>errors.push(e.error().message));
  try{
   if(label!=='baseline'&&process.env.RECALL_ETTIN_MODELS){
    const assets=await import(pathToFileURL(path.join(source,'offscreen/rerank-assets.js')).href),prefix=`https://huggingface.co/${assets.RERANK_MODEL}/resolve/${assets.RERANK_REVISION}/`;
    await f.context.route(prefix+'**',async route=>{const file=route.request().url().slice(prefix.length);assert.ok(Object.hasOwn(assets.RERANK_ASSETS,file));downloads.push(file);await route.fulfill({path:path.join(process.env.RECALL_ETTIN_MODELS,file),contentType:'application/octet-stream'});});
   }
   await f.enable();
   async function seed(videos){for(const v of videos){const r=await f.send({target:'offscreen',type:'index',method:'controlled-test',video:{videoId:id(v.videoId),title:v.title,channel:v.channel,watchedAt},segments:v.chunks.map(c=>({...c,dur:8}))});assert.equal(r.error,undefined);}}
   async function collect(split,queries){for(const [i,q]of queries.entries()){
    const t=performance.now(),r=await f.send({target:'offscreen',type:'search',query:q.query,perVideo:1,limit:20});assert.equal(r.error,undefined);
    const expected=q.expected.map(id),position=r.results.findIndex(h=>expected.includes(h.videoId));
    rows.push({split,query:q.query,group:q.group,expected,top1:position===0,top5:position>=0&&position<5,ms:performance.now()-t,reranked:!!r.reranked,pending:!!r.rerankPending,hits:r.results});
    if((i+1)%100===0)console.log('ETTIN_SEARCH_PROGRESS',label,split,i+1+'/'+queries.length);
    if(r.reranked)await new Promise(resolve=>setTimeout(resolve,400));
   }}
   await seed(stress.videos);
   if(label!=='baseline'){
    // Strong/quoted searches never start the optional model.
    await f.send({target:'offscreen',type:'search',query:'"lithium trapped"',perVideo:1,limit:20});
    assert.equal((await f.send({type:'status'})).reranker.status,'idle');
    const coldStart=performance.now(),cold=await f.send({target:'offscreen',type:'search',query:'a video of the speaker calling himselve old and having back pain',perVideo:2,limit:40});
    assert.equal(cold.error,undefined);assert.equal(cold.rerankPending,true);assert.ok(performance.now()-coldStart<1800,'first eligible query must not await model download');
    await f.wait(async()=>((await f.send({type:'status'})).reranker?.status==='ready'));
    const retry=await f.send({target:'offscreen',type:'search',query:'a video of the speaker calling himselve old and having back pain',perVideo:2,limit:40});assert.equal(retry.rerankPending,undefined);assert.equal(retry.results[0].videoId,'iGDOWFcMRDs');
   }
   await collect('legacy',stress.queries);await collect('guards',guards.queries);
   await seed(fresh.videos);await collect('validation',fresh.queries);await collect('diagnostic',confirm.queries);
   await seed(holdout.videos);await collect('holdout',holdout.queries);
   await seed(final.videos);await collect('final',final.queries);
   let cancellation;
   if(label!=='baseline'){
    const stale=f.send({target:'offscreen',type:'search',query:'twisting the little knob wont replace a dead battery .',perVideo:1,limit:20});
    const deadline=Date.now()+1000;let working=false;
    while(Date.now()<deadline){if((await f.send({type:'status'})).reranker.status==='working'){working=true;break;}await new Promise(resolve=>setTimeout(resolve,5));}
    assert.equal(working,true,'exercise cancellation during actual inference');
    const t=performance.now(),newer=await f.send({target:'offscreen',type:'search',query:'"bad back"',perVideo:1,limit:20});
    assert.equal(newer.error,undefined);assert.equal(newer.reranked,undefined);
    assert.equal((await stale).reranked,undefined,'stale inference must retain its baseline rather than publishing a new order');
    assert.equal((await f.send({type:'status'})).reranker.status,'idle','obsolete inference releases its worker');
    cancellation={newSearchMs:performance.now()-t,staleInferenceStopped:true};assert.ok(cancellation.newSearchMs<1000);
    await f.send({target:'offscreen',type:'search',query:'twisting the little knob wont replace a dead battery ..',perVideo:1,limit:20});
    await f.wait(async()=>((await f.send({type:'status'})).reranker?.status==='ready'));
   }
   const q='a video of the speaker calling himselve old and having back pain';
   const all=await f.send({target:'offscreen',type:'search',query:q,perVideo:1,limit:100});assert.equal(all.error,undefined);
   const paged=[];for(let offset=0;offset<Math.min(all.results.length,36);offset+=12){const page=await f.send({target:'offscreen',type:'search',query:q,perVideo:1,limit:12,offset});assert.equal(page.error,undefined);paged.push(...page.results);}
   assert.deepEqual(paged,all.results.slice(0,paged.length),'paging preserves owner order and timestamps');
   const excluded=await f.send({target:'offscreen',type:'search',query:q,perVideo:1,limit:20,exclude:['iGDOWFcMRDs']});assert.ok(!excluded.results.some(h=>h.videoId==='iGDOWFcMRDs'));
   const only=await f.send({target:'offscreen',type:'search',query:q,perVideo:1,limit:20,videoId:'iGDOWFcMRDs'});assert.ok(only.results.every(h=>h.videoId==='iGDOWFcMRDs'));
   const future=await f.send({target:'offscreen',type:'search',query:q,perVideo:1,limit:20,sinceMs:Date.now()+60000});assert.deepEqual(future.results,[]);
   const pageOnly=await f.send({target:'offscreen',type:'search',query:q,perVideo:1,limit:20,kind:'page'});assert.deepEqual(pageOnly.results,[]);
   const popup=await f.context.newPage();await popup.goto(f.base+'/popup/popup.html');await popup.locator('#q').fill(q);await popup.locator('#q').press('Enter');
   await popup.waitForFunction(()=>document.querySelector('.best .result')?.href.includes('v=iGDOWFcMRDs'));await popup.setViewportSize({width:440,height:600});
   if(label!=='baseline')await popup.screenshot({path:path.join(out,'cuewoven-ettin-popup.png'),fullPage:true});
   const removed=await f.send({type:'delete',videoId:'iGDOWFcMRDs'});assert.equal(removed.error,undefined);
   const afterDelete=await f.send({type:'search',query:q,distinct:true});assert.ok(!afterDelete.results.some(h=>h.videoId==='iGDOWFcMRDs'));
   const cleared=await f.send({type:'clear'});assert.equal(cleared.error,undefined);const empty=await f.send({type:'search',query:q,distinct:true});assert.deepEqual(empty.results,[]);
   assert.deepEqual(errors,[]);
   const phases=Object.fromEntries([...new Set(rows.map(r=>r.split))].map(split=>[split,summary(rows.filter(r=>r.split===split))]));
   reports.push({label,browser:await f.context.browser().version(),phases,summary:summary(rows),cancellation,checks:{coldLoadNonblocking:label!=='baseline',pagination:true,exclusions:true,singleVideo:true,dateRange:true,kind:true,popup:true,delete:true,clear:true},downloads,errors,rows});
   fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'cuewoven-ettin-search-tests.json'),JSON.stringify({methodology:'Sequential isolated Edge profiles, real MiniLM indexing and selective Ettin inference; authored correlated fixtures, not a personal-library accuracy estimate. Same case phases/library sizes as the research study.',reports},null,2));
   console.log('ETTIN_SEARCH_RESULT',label,JSON.stringify(phases));
  }finally{await f.close();}
 }
 if(reports.length===2){
  const [baseline,selective]=reports;assert.equal(baseline.rows.length,selective.rows.length);const changes=[];
  for(let i=0;i<baseline.rows.length;i++){
   const a=baseline.rows[i],b=selective.rows[i];assert.equal(a.query,b.query);assert.equal(a.split,b.split);
   const before=new Map(a.hits.map(h=>[h.videoId,h]));
   // Each isolated library is indexed at a different wall-clock time.
   const comparable=({indexedAt,...hit})=>hit;
   for(const hit of b.hits)if(before.has(hit.videoId))assert.deepEqual(comparable(hit),comparable(before.get(hit.videoId)),'reranking only changes order, never saved evidence/score/playback timestamp');
   if(a.top1!==b.top1)changes.push({split:a.split,query:a.query,gain:b.top1,loss:a.top1});
  }
  const comparison={gains:changes.filter(r=>r.gain).length,losses:changes.filter(r=>r.loss).length,changes};
  fs.writeFileSync(path.join(out,'cuewoven-ettin-search-comparison.json'),JSON.stringify(comparison,null,2));
  console.log('ETTIN_SEARCH_COMPARISON',JSON.stringify(comparison));assert.equal(comparison.losses,0,'selective implementation displaced a previously correct first result');
 }
 console.log('SELECTIVE_ETTIN_INTEGRATION_PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
