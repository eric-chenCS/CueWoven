const fixture=require('./web-fixture.cjs'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
(async()=>{
 const base=await import(pathToFileURL(path.resolve(__dirname,'../fixtures/search-stress.mjs')).href),fresh=await import(pathToFileURL(path.resolve(__dirname,'../fixtures/search-fresh.mjs')).href);
 const original=process.env.RECALL_EXTENSION,baseline=process.env.RECALL_BASELINE_EXTENSION;if(!baseline)throw Error('Set RECALL_BASELINE_EXTENSION to the pre-change snapshot.');
 const reports=[],id=v=>v.padEnd(11,'_').slice(0,11),quantile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)];
 for(const [label,root] of [['baseline',baseline],['candidate',original]]){
  if(root)process.env.RECALL_EXTENSION=root;else delete process.env.RECALL_EXTENSION;
  const f=await fixture(),rows=[],errors=[];f.context.on('weberror',e=>errors.push(e.error().message));
  try{
   await f.enable();
   for(const v of [...base.videos,...fresh.videos]){const r=await f.send({target:'offscreen',type:'index',method:'controlled-test',video:{videoId:id(v.videoId),title:v.title,channel:v.channel,watchedAt:Date.now()},segments:v.chunks.map(c=>({...c,dur:8}))});if(r.error)throw Error(r.error);}
   for(const [i,q] of fresh.queries.entries()){
    const begin=performance.now(),r=await f.send({target:'offscreen',type:'search',query:q.query,perVideo:1,limit:20});if(r.error)throw Error(r.error);
    const expected=q.expected.map(id),hits=r.results||[],position=hits.findIndex(h=>expected.includes(h.videoId));
    rows.push({id:i+1,...q,expected,latencyMs:performance.now()-begin,top1:position===0,top5:position>=0&&position<5,top20:position>=0,hits:hits.slice(0,5).map(h=>({videoId:h.videoId,score:h.score,match:h.match,text:h.text}))});
   }
   const groups={};for(const row of rows){const g=groups[row.group]||={total:0,top1:0,top5:0};g.total++;g.top1+=Number(row.top1);g.top5+=Number(row.top5);}
   const report={label,browser:await f.context.browser()?.version(),total:rows.length,videos:base.videos.length+fresh.videos.length,top1:rows.filter(r=>r.top1).length,top5:rows.filter(r=>r.top5).length,p50Ms:quantile(rows.map(r=>r.latencyMs),.5),p95Ms:quantile(rows.map(r=>r.latencyMs),.95),groups,errors,rows};reports.push(report);
   console.log('FRESH_RESULT',JSON.stringify({...report,rows:undefined}));assert.deepEqual(errors,[]);
  }finally{await f.close();}
 }
 const [before,after]=reports,changed=before.rows.map((r,i)=>({query:r.query,before:r.top1,after:after.rows[i].top1})).filter(r=>r.before!==r.after);
 const report={methodology:'120 cases frozen before experiments: 80 authored paraphrases and 40 conversational/typo variants, on 61 competing videos. Baseline and candidate run sequentially in fresh isolated Edge profiles with real local MiniLM. Validation set used to reject prefix cleanup and check the predefined comparative-only alternative; no edits were made to fit its misses. Not an untouched final holdout.',reports,changed};
 const output=process.env.RECALL_REPORT_DIR||process.env.RECALL_TEST_ROOT||require('os').tmpdir();fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'cuewoven-search-fresh-comparison.json'),JSON.stringify(report,null,2));
 console.log('FRESH_CHANGES',JSON.stringify(changed));assert.equal(after.total,120);assert.ok(after.top1>=before.top1,'fresh top-one retrieval regressed');assert.ok(after.top5>=before.top5,'fresh top-five retrieval regressed');assert.ok(after.p95Ms<before.p95Ms+100,'query latency regressed by at least 100 ms');console.log('FRESH_COMPARISON_PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
