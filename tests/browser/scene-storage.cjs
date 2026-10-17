const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright'),fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-scene-storage-')),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),base=`chrome-extension://${new URL(worker.url()).hostname}`,page=await context.newPage();
  const image=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');ctx.fillStyle='#345b78';ctx.fillRect(0,0,320,180);return canvas.toDataURL('image/jpeg',.6)});
  await worker.evaluate(async image=>{
   await chrome.offscreen.closeDocument().catch(()=>{});await chrome.storage.local.set({settings:{enabled:false,screenTextEnabled:false,scenesEnabled:false}});
   await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase('recall');request.onsuccess=resolve;request.onerror=()=>reject(request.error)});
   await new Promise((resolve,reject)=>{const request=indexedDB.open('recall',2);request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('videos',{keyPath:'videoId'});db.createObjectStore('chunks',{keyPath:'id',autoIncrement:true}).createIndex('videoId','videoId');const scenes=db.createObjectStore('scenes',{keyPath:'key'});scenes.createIndex('videoId','videoId');scenes.createIndex('indexedAt','indexedAt')};request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction(['videos','scenes'],'readwrite');tx.objectStore('videos').put({videoId:'aaaaaaaaaaa',title:'Legacy scene',sceneCount:1,historyImported:false,watchedAt:12345});tx.objectStore('scenes').put({key:'aaaaaaaaaaa:1',videoId:'aaaaaaaaaaa',start:20,image,indexedAt:12345,vec:new Float32Array(512)});tx.oncomplete=()=>{db.close();resolve()}}});
  },image);
  await page.goto(`${base}/options/options.html`);
  const results=await page.evaluate(async image=>{
   const db=await import(chrome.runtime.getURL('lib/db.js')),{compressedScene}=await import(chrome.runtime.getURL('lib/scene-db.js')),{rankScenes,SCENE_BYTES_TOTAL}=await import(chrome.runtime.getURL('lib/scenes.js'));
   const first=await db.scenes.get('aaaaaaaaaaa:1'),legacy=await db.getVideo('aaaaaaaaaaa');
   const database=await new Promise((resolve,reject)=>{const request=indexedDB.open('recall',3);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
   const req=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)}),done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
   const raw=await req(database.transaction('scenes').objectStore('scenes').get(first.key));
   await db.clearAll();const videos=new Map(),vec=new Float32Array(512);vec[0]=.4;vec[1]=Math.sqrt(1-.4*.4);
   const tx=database.transaction(['videos','scenes'],'readwrite'),complete=done(tx),store=tx.objectStore('scenes');
   for(let j=0;j<40;j++){const id=String(j).padStart(11,'a'),video={videoId:id,title:'Storage sample',sceneCount:50,watchedAt:Date.now()};videos.set(id,video);tx.objectStore('videos').put(video);for(let i=0;i<50;i++)store.put(compressedScene({key:id+':'+i,videoId:id,start:i*20,indexedAt:j*50+i+1,image,vec}));}await complete;
   const q=new Float32Array(512);q[0]=1;const all=await db.scenes.vectors(),bench=count=>{const rows=all.slice(0,count),times=[];for(let i=0;i<25;i++){const started=performance.now();rankScenes(q,rows,videos,{limit:12});times.push(performance.now()-started)}return times.sort((a,b)=>a-b)[12];};
   const ranking={frames1000Ms:bench(1000),frames2000Ms:bench(2000)};
   const start=performance.now(),read=await db.scenes.vectors(),metadataReadMs=performance.now()-start;
   const before=(await req(database.transaction('scenes').objectStore('scenes').getAll())).reduce((n,row)=>n+row.bytes,0);
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(320,180);let seed=12345;for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;pixels.data[i]=seed&255;pixels.data[i+1]=(seed>>>8)&255;pixels.data[i+2]=(seed>>>16)&255;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);const noisy=canvas.toDataURL('image/jpeg',.6);
   const large=database.transaction('scenes','readwrite'),finished=done(large);for(const row of all)large.objectStore('scenes').put(compressedScene({...row,image:noisy}));await finished;
   const putStart=performance.now();await db.scenes.put({...all[0],image:noisy,indexedAt:30000});const budgetPutMs=performance.now()-putStart;
   const bounded=await req(database.transaction('scenes').objectStore('scenes').getAll());database.close();
   return {migration:{sameImage:first.image===image,blob:raw.image instanceof Blob,start:first.start,watch:legacy.watchedAt,count:legacy.sceneCount},ranking,metadataReadMs,metadataCount:read.length,imagesExcluded:read.every(row=>!('image' in row)),normalBytes:before,budgetBytes:bounded.reduce((n,row)=>n+row.bytes,0),budgetCount:bounded.length,budget:SCENE_BYTES_TOTAL,budgetPutMs};
  },image);
  console.log('SCENE_STORAGE_RESULT',JSON.stringify(results));assert.deepEqual(results.migration,{sameImage:true,blob:true,start:20,watch:12345,count:1});assert.equal(results.metadataCount,2000);assert.ok(results.imagesExcluded);assert.ok(results.budgetBytes<=results.budget);assert.ok(results.budgetCount<2000);assert.ok(results.ranking.frames2000Ms<100);assert.ok(results.metadataReadMs<500);
  const textLimits=await page.evaluate(async()=>{
   const db=await import(chrome.runtime.getURL('lib/db.js'));await db.clearAll();
   const database=await new Promise((resolve,reject)=>{const request=indexedDB.open('recall',3);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)}),done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
   const vec=new Float32Array(384),tx=database.transaction(['videos','screenText'],'readwrite'),complete=done(tx);
   tx.objectStore('videos').put({videoId:'aaaaaaaaaaa',title:'OCR cap',screenCount:730});for(let i=0;i<730;i++)tx.objectStore('screenText').put({key:'aaaaaaaaaaa:'+i,videoId:'aaaaaaaaaaa',start:i*5,text:'sample words',vec,indexedAt:i+1});await complete;
   await db.screenText.put({key:'aaaaaaaaaaa:730',videoId:'aaaaaaaaaaa',start:3650,text:'sample words',vec,indexedAt:1000});const own=(await db.getVideo('aaaaaaaaaaa')).screenCount;
   const more=database.transaction(['videos','screenText'],'readwrite'),finished=done(more);for(let j=0;j<16;j++){const id=String(j).padStart(11,'b');more.objectStore('videos').put({videoId:id,title:'OCR cap',screenCount:600});for(let i=0;i<600;i++)more.objectStore('screenText').put({key:id+':'+i,videoId:id,start:i*5,text:'sample words',vec,indexedAt:2000+j*600+i});}await finished;
   await db.screenText.put({key:'aaaaaaaaaaa:731',videoId:'aaaaaaaaaaa',start:3655,text:'sample words',vec,indexedAt:20000});const total=(await db.screenText.all()).length;const removed=await db.screenText.prune(30000);const after=(await db.listVideos()).reduce((sum,video)=>sum+(video.screenCount||0),0);database.close();return {own,total,removed,after};
  });assert.deepEqual(textLimits,{own:720,total:10000,removed:10000,after:0});
  console.log('SCENE_STORAGE_PASS: v2 to v3 preserves exact JPEG/dates, compressed Blob storage, 2,000-frame ranking, no image strings in search metadata 24 MiB budget enforcement and bounded OCR text counts/pruning.');
 }finally{await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
