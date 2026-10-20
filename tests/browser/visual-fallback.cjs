const fixture=require('./web-fixture.cjs'),assert=require('assert/strict');
(async()=>{
 const f=await fixture(),errors=[];
 f.context.on('weberror',event=>errors.push(event.error().message));
 try{
  await f.enable({scenes:true});
  const seeded=await f.options.evaluate(async()=>{
   const send=msg=>chrome.runtime.sendMessage(msg);
   const blob=await(await fetch('https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/cats.png')).blob();
   const image=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;canvas.getContext('2d').drawImage(image,0,0,320,180);image.close();
   const saved=await send({target:'offscreen',type:'scene-index',video:{videoId:'visual00001',title:'First session',watchedAt:Date.now()},start:40,image:canvas.toDataURL('image/jpeg',.6)});if(saved.error)throw Error(saved.error);
   for(const [videoId,title,text] of [['textbest001','Battery chemistry','Lithium trapped on graphite reduces the capacity of rechargeable batteries.'],['textnext001','Battery maintenance','Charging and temperature can reduce battery capacity over many years.']]){
    const result=await send({target:'offscreen',type:'index',video:{videoId,title,watchedAt:Date.now()},segments:[{start:42,text}],method:'controlled-test'});if(result.error)throw Error(result.error);
   }
   await send({target:'offscreen',type:'vision-stop'});
   window.visualTextQueries=0;chrome.runtime.onMessage.addListener(msg=>{if(msg.type==='vision-state'&&msg.state.status==='working'&&msg.state.operation==='text')visualTextQueries++;});
   return true;
  });assert.equal(seeded,true);
  const spoken=await f.send({type:'search',query:'lithium trapped on graphite',distinct:true});
  assert.equal(spoken.error,undefined);assert.equal(spoken.results[0].videoId,'textbest001');assert.equal(spoken.results[0].start,42);
  assert.ok(spoken.results.every(hit=>!hit.scene&&!hit.articleImage));
  const end=await f.send({type:'search',query:'lithium trapped on graphite',distinct:true,offset:24});assert.deepEqual(end.results,[]);
  assert.equal(await f.options.evaluate(()=>visualTextQueries),0,'relevant text and later pages do not run image search');
  for(const videoId of ['textbest001','textnext001']){const deleted=await f.send({type:'delete',videoId});assert.equal(deleted.error,undefined);}
  const visual=await f.send({type:'search',query:'two cats sitting on a sofa',distinct:true});
  assert.equal(visual.error,undefined);assert.equal(visual.results[0].videoId,'visual00001');assert.equal(visual.results[0].scene,true);assert.deepEqual(visual.results[0].matchSources,['Scene']);assert.ok(visual.results[0].image.startsWith('data:image/jpeg'));
  assert.ok(await f.options.evaluate(()=>visualTextQueries)>0,'visual fallback still uses the real CLIP model');
  assert.deepEqual(errors,[]);
  console.log('VISUAL_FALLBACK_PASS',JSON.stringify({textFirst:true,preservedTimestamp:42,noVisualInferenceForRelevantText:true,stableTextPagination:true,realClipFallback:true,visualScore:visual.results[0].score}));
 }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
