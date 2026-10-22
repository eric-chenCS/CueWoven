const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const report={checks:[],errors:[]};
(async()=>{
 const f=await fixture();f.context.on('weberror',event=>report.errors.push(event.error().message));
 try{
  await f.send({type:'settings-defaults'});await f.enable({scenes:true});
  const indexed=await f.send({target:'offscreen',type:'index',method:'controlled-test',video:{videoId:'lifeText001',title:'Coral observations',watchedAt:Date.now()},segments:[{start:42,text:'Coral bleaching happens when warm ocean water drives away symbiotic algae.'}]});assert.equal(indexed.error,undefined);
  const scene=await f.options.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,320,180);ctx.fillStyle='red';ctx.fillRect(90,20,140,140);
   return chrome.runtime.sendMessage({target:'offscreen',type:'scene-index',video:{videoId:'lifeScene01',title:'Visual memory',watchedAt:Date.now()},start:64,image:canvas.toDataURL('image/jpeg',.8)});
  });assert.equal(scene.error,undefined);
  await f.send({target:'offscreen',type:'vision-stop'});
  const ready=await f.send({type:'warmup',scenes:true});assert.equal(ready.error,undefined);
  assert.equal((await f.send({type:'vision-status'})).status,'idle','even legacy scene warmup flags must not load CLIP on popup open');
  const text=await f.send({type:'search',query:'"warm ocean water"',distinct:true,inferFilters:false});
  assert.equal(text.results[0].videoId,'lifeText001');assert.equal(text.results[0].start,42);
  assert.equal((await f.send({type:'vision-status'})).status,'idle','strong text search keeps CLIP unloaded');
  report.checks.push('popup warmup and strong text search leave visual model unloaded despite saved scenes');
  const started=performance.now();
  let visual=await f.send({type:'search',query:'a red square on a white background',videoId:'lifeScene01',distinct:true,inferFilters:false});
  report.firstVisualResponseMs=performance.now()-started;
  if(process.env.RECALL_MODEL_DIR){
   assert.ok(!visual.visualPending,'cached-model acceptance requires results from the first visual search, without a retry');
   assert.ok(report.firstVisualResponseMs<2000,'cached first visual search exceeds the 2-second laptop budget');
  }
  if(visual.visualPending){await f.wait(async()=>((await f.send({type:'vision-status'})).status==='ready'));visual=await f.send({type:'search',query:'a red square on a white background',videoId:'lifeScene01',distinct:true,inferFilters:false});}
  assert.equal(visual.error,undefined);assert.equal(visual.results[0].videoId,'lifeScene01');assert.equal(visual.results[0].start,64);
  report.checks.push('actual visual fallback loads on demand and preserves the scene timestamp');
  await f.send({target:'offscreen',type:'vision-stop'});
  assert.equal((await f.send({type:'vision-status'})).status,'idle');
  assert.equal((await f.send({type:'list'})).videos.length,2,'unloading models never deletes saved evidence');
  report.textReload = await f.options.evaluate(async()=>{
   const {createTextModel}=await import(chrome.runtime.getURL('offscreen/text-model.js'));
   let state;
   const model=createTextModel(value=>{state=value;},{idleMs:100});
   try{
    await model.warmup();const warmStart=performance.now();
    const warm=await model.embed(['A warm query about coral bleaching.'],{priority:'query'}),warmMs=performance.now()-warmStart;
    const deadline=performance.now()+5000;
    while(state.status!=='idle'){if(performance.now()>deadline)throw Error('Text worker did not unload');await new Promise(resolve=>setTimeout(resolve,20));}
    const start=performance.now(),fresh=await model.embed(['A different query after the worker unloads.'],{priority:'query'});
    return{warmMs,reloadMs:performance.now()-start,warmDim:warm[0].length,reloadedDim:fresh[0].length,acceleratedIdleForReloadCheck:true};
   }finally{model.release();}
  });
  assert.equal(report.textReload.warmDim,384);assert.equal(report.textReload.reloadedDim,384);
  assert.deepEqual(report.errors,[]);report.pass=true;console.log('RESOURCE_LIFECYCLE_PASS',JSON.stringify(report));
 }finally{if(process.env.RECALL_REPORT_DIR)fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR,'resource-lifecycle.json'),JSON.stringify(report,null,2));await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
