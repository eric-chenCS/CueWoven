const fixture=require('./web-fixture.cjs'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
(async()=>{const set=await import(pathToFileURL(path.resolve(__dirname,'../fixtures/search-stress.mjs')).href),f=await fixture();
 const output=process.env.RECALL_REPORT_DIR||process.env.RECALL_TEST_ROOT||require('os').tmpdir(),rows=[],errors=[];f.context.on('weberror',e=>errors.push(e.error().message));
 const id=v=>v.padEnd(11,'_').slice(0,11),began=Date.now();
 try{
 await f.enable();
 for(const v of set.videos){const r=await f.send({target:'offscreen',type:'index',method:'controlled-test',video:{videoId:id(v.videoId),title:v.title,channel:v.channel,watchedAt:Date.now()},segments:v.chunks.map(c=>({...c,dur:8}))});if(r.error)throw Error(v.videoId+': '+r.error);}
 console.log('STRESS_INDEXED',set.videos.length,'videos, transcript only; real MiniLM, no scenes');
 for(const q of set.queries){
 const started=Date.now(),r=await f.send({target:'offscreen',type:'search',query:q.query,perVideo:1,limit:20});if(r.error)throw Error(q.id+': '+r.error);
 const expected=q.expected.map(id),hits=r.results||[],pos=hits.findIndex(h=>expected.includes(h.videoId));
 rows.push({...q,expected,latencyMs:Date.now()-started,top1:expected.length?pos===0:hits.length===0,top5:expected.length?pos>=0&&pos<5:null,top20:expected.length?pos>=0:null,returned:hits.length,hits:hits.slice(0,5).map(h=>({videoId:h.videoId,score:h.score,match:h.match,start:h.start,text:h.text}))});
 if(rows.length%100===0)console.log('STRESS_PROGRESS',rows.length+'/1000');
 }
 const groups={};for(const row of rows){const g=groups[row.group]||= {total:0,top1:0,top5:0,top20:0,closeWrong:0};g.total++;g.top1+=Number(row.top1);g.top5+=Number(row.top5);g.top20+=Number(row.top20);g.closeWrong+=Number(!row.top1&&row.hits[0]?.match==='close');}
 const known=rows.filter(r=>r.expected.length),report={browser:await f.context.browser()?.version(),model:'Xenova/all-MiniLM-L6-v2 (real quantized model)',videos:set.videos.length,total:rows.length,elapsedMs:Date.now()-began,methodology:'726 transformed cases from 121 existing seeds, 108 new hard paraphrases, 16 user-transcript queries, 100 typo variants of new cases, 25 ambiguous and 25 absent-topic probes. Not 1000 independent examples or a real-user accuracy estimate. Expected labels frozen before execution; controlled suite used to compare lexical changes. Not an independent holdout.',groups,known:{total:known.length,top1:known.filter(r=>r.top1).length,top5:known.filter(r=>r.top5).length,top20:known.filter(r=>r.top20).length},errors,rows};
 fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'cuewoven-search-1000.json'),JSON.stringify(report,null,2));
 console.log('STRESS_SUMMARY',JSON.stringify({...report,rows:undefined}));
 assert.equal(rows.length,1000);assert.deepEqual(errors,[]);
 assert.ok(groups.baseline.top1>=119,'existing baseline regression');
 for(const original of rows.filter(r=>r.group==='user-transcript').slice(0,2))assert.equal(original.top1,true,'original user query should find transcript without scenes: '+original.query);
 // Exercise the user's exact wording through the actual popup as well as the engine.
 const popup=await f.context.newPage();await popup.goto(f.base+'/popup/popup.html');
 for(const original of rows.filter(r=>r.group==='user-transcript').slice(0,2)){
  await popup.locator('#q').fill(original.query);await popup.locator('#q').press('Enter');
  await popup.waitForFunction(()=>document.querySelector('.best .result')?.href.includes('v=iGDOWFcMRDs'));
  assert.match(await popup.locator('.best .match-sources').innerText(),/Transcript/);
 }
 await popup.setViewportSize({width:440,height:600});await popup.screenshot({path:path.join(output,'cuewoven-exact-query-fixed.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log('USER_QUERY_POPUP_PASS: both original spellings find the supplied transcript first, without scenes');
 console.log('STRESS_EXECUTION_PASS (accuracy and misses are in report; does not mean 1000 correct)');
 }finally{await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
