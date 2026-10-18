const fixture=require('./web-fixture.cjs'),assert=require('assert/strict');
const {captureOptionsMessages,installControlledQueue}=require('./queue-fixture.cjs');
(async()=>{
 const f=await fixture();
 try{
  await captureOptionsMessages(f.context);await f.options.reload();await installControlledQueue(f.options);
  const entries=Array.from({length:205},(_,i)=>({title:'Watched imported source '+i,titleUrl:'https://www.youtube.com/watch?v='+String(i).padStart(11,'a'),time:new Date(Date.UTC(2020,0,i+1)).toISOString()}));
  await f.options.locator('#takeout-import').setInputFiles({name:'watch-history.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(entries))});
  await f.options.waitForFunction(()=>document.querySelector('#bulk-summary').textContent.startsWith('Finished:'),null,{timeout:120000});
  const ids=await f.options.evaluate(()=>window.bulkCalls);
  assert.equal(ids.length,200);assert.equal(ids[0],String(204).padStart(11,'a'));assert.equal(ids.at(-1),String(5).padStart(11,'a'));
  assert.equal((await f.send({type:'list'})).videos.length,205);
  assert.ok((await f.send({type:'list'})).videos.every(video=>video.historyImported===true));
  console.log('IMPORT_LIMIT_PASS: all 205 titles retained, newest 200 queued automatically, import provenance retained. Controlled caption outcomes.');
 }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
