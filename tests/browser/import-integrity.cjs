const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright'),fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-import-integrity-')),{headless:true,executablePath:process.env.RECALL_BROWSER,viewport:{width:960,height:900},args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),page=await context.newPage();await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/options/options.html`);
  await page.evaluate(()=>chrome.storage.local.set({settings:{enabled:false,maxAgeDays:0,speechEnabled:false,screenTextEnabled:false,scenesEnabled:false}}));
  const results=await page.evaluate(async()=>{
   const send=msg=>chrome.runtime.sendMessage(msg),db=await import(chrome.runtime.getURL('lib/db.js'));await db.clearAll();
   const original=Date.parse('2020-01-01'),video={videoId:'aaaaaaaaaaa',title:'Battery chemistry',channel:'Fixture',watchedAt:original};
   await send({target:'offscreen',type:'import-history',videos:[video]});
   await chrome.storage.local.set({settings:{enabled:true,maxAgeDays:0,speechEnabled:false,screenTextEnabled:false,scenesEnabled:false}});
   const indexed=await send({target:'offscreen',type:'index',video:{videoId:video.videoId,title:video.title},method:'controlled-captions',segments:[{start:42,text:'Repeated charging traps active lithium and reduces battery capacity.'}]});if(indexed.error)throw Error(indexed.error);
   const after=await db.getVideo(video.videoId),chunks=await db.chunksOf(video.videoId),old=Date.now()-31*864e5;
   await db.replaceVideo({...after,indexedAt:old},chunks.map(({id,...chunk})=>chunk));
   await chrome.storage.local.set({settings:{enabled:false,maxAgeDays:30,speechEnabled:false,screenTextEnabled:false,scenesEnabled:false}});await send({type:'prune'});
   const survived=!!await db.getVideo(video.videoId);
   const {historyImported,...legacy}=after;await db.replaceVideo(legacy,chunks.map(({id,...chunk})=>chunk));
   const repaired=await send({target:'offscreen',type:'import-history',videos:[video]});const repairedVideo=await db.getVideo(video.videoId);
   const watched=Date.now();await db.touchWatch(video.videoId,watched);
   await db.replaceVideo({...after,historyImported:true},chunks.map(({id,...chunk})=>chunk),{backgroundCapture:true});
   const raced=await db.getVideo(video.videoId),unchanged=await send({target:'offscreen',type:'import-history',videos:[video]});
   await db.replaceVideo({...after,historyImported:true},chunks.map(({id,...chunk})=>chunk));
   const restored=await db.getVideo(video.videoId);
   return {afterFlag:after.historyImported,afterWatch:after.watchedAt,survived,repaired:repaired.repaired,repairedFlag:repairedVideo.historyImported,watchWon:raced.watchedAt===watched,raceFlag:raced.historyImported,liveRepair:unchanged.repaired,restoreWatchWon:restored.historyImported===false&&restored.watchedAt===watched};
  });
  assert.deepEqual(results,{afterFlag:true,afterWatch:Date.parse('2020-01-01'),survived:true,repaired:1,repairedFlag:true,watchWon:true,raceFlag:false,liveRepair:0,restoreWatchWon:true});
  // Start genuine visual inference, then restore through the actual file-input UI.
  await page.evaluate(async()=>{
   const db=await import(chrome.runtime.getURL('lib/db.js'));const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;canvas.getContext('2d').fillRect(0,0,320,180);
   window.pendingScene=chrome.runtime.sendMessage({target:'offscreen',type:'scene-index',video:{videoId:'aaaaaaaaaaa',title:'Battery chemistry'},start:20,image:canvas.toDataURL('image/jpeg',.6)});
   const send=chrome.runtime.sendMessage.bind(chrome.runtime);window.restoreAttempts=0;chrome.runtime.sendMessage=msg=>{if(msg.type==='import')restoreAttempts++;return send(msg)};
  });
  await page.waitForFunction(async()=>(await chrome.runtime.sendMessage({type:'vision-status'})).busy);
  const backup={format:'recall-export',videos:[{videoId:'bbbbbbbbbbb',title:'Restored while scene was busy',method:'history-title',historyImported:true,watchedAt:10,chunks:[{start:0,text:'Restored video title'}]}]};
  await page.locator('#import').setInputFiles({name:'recall-test-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await page.waitForFunction(()=>document.querySelector('#data-msg').textContent==='Imported 1 videos.',null,{timeout:120000});
  assert.equal(await page.evaluate(()=>restoreAttempts),1,'capture hold drains the scene without a busy retry');
  await page.evaluate(async()=>{const result=await pendingScene;if(result.error)throw Error(result.error)});
  console.log('IMPORT_INTEGRITY_PASS: imported captions survive 31-day retention, Takeout repairs missing origin safely, concurrent watch wins, scene capture hold during restore.');
 }finally{await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
