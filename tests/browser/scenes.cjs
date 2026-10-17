const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=process.env.RECALL_EXTENSION || path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-scenes-')),{headless:true,executablePath:process.env.RECALL_BROWSER,viewport:{width:480,height:780},args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 const errors=[];context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
 let image;
 await context.route('https://www.youtube.com/**',route=>{
  const url=new URL(route.request().url()),id=url.searchParams.get('v');
  if(url.pathname==='/api/timedtext')return route.fulfill({contentType:'application/json',body:JSON.stringify({events:[{tStartMs:42000,segs:[{utf8:'Battery charging cycles damage electrodes and reduce phone energy capacity.'}]},{tStartMs:47000,segs:[{utf8:'Chemical reactions reduce the amount of charge the battery can store.'}]},{tStartMs:52000,segs:[{utf8:'The battery ages as these reactions continue over time.'}]}]})});
  if(url.pathname!=='/watch')return route.fulfill({status:404,body:''});
  const cats=id!=='bbbbbbbbbbb';
  const player={videoDetails:{videoId:id,title:cats?'First session':'Battery science',author:'Fixture',lengthSeconds:'600'}};
  if(!cats)player.captions={playerCaptionsTracklistRenderer:{captionTracks:[{languageCode:'en',baseUrl:'https://www.youtube.com/api/timedtext?v='+id}]}};
  return route.fulfill({contentType:'text/html',body:`<!doctype html><button id="play">Play</button><video muted playsinline></video><canvas id="source" width="640" height="360" hidden></canvas><script>window.ytInitialPlayerResponse=${JSON.stringify(player)};const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),video=document.querySelector('video');const picture=new Image();picture.src=${JSON.stringify(image)};function draw(){ctx.fillStyle='white';ctx.fillRect(0,0,640,360);${cats?'if(picture.complete)ctx.drawImage(picture,0,0,640,360);':"ctx.fillStyle='blue';ctx.fillRect(50,200,90,120);ctx.fillStyle='red';ctx.fillRect(200,80,90,240);ctx.fillStyle='black';ctx.font='32px sans-serif';ctx.fillText('ENERGY CAPACITY',50,50);"}}setInterval(draw,100);draw();video.srcObject=canvas.captureStream(10);document.querySelector('button').onclick=()=>video.play();</script>`});
 });
 try {
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),base=`chrome-extension://${new URL(worker.url()).hostname}`;
  let options=await context.newPage();await options.goto(`${base}/options/options.html`);
  image=await options.evaluate(async()=>{const blob=await(await fetch('https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/cats.png')).blob();const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;canvas.getContext('2d').drawImage(bitmap,0,0,320,180);bitmap.close();return canvas.toDataURL('image/jpeg',0.6)});
  // Recreate the existing v1 database, then let production code migrate it.
  for(const page of context.pages().filter(page=>page.url().includes('/options/')))await page.close();
  await worker.evaluate(async()=>{
   await chrome.offscreen.closeDocument().catch(()=>{});
   await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase('recall');request.onsuccess=resolve;request.onerror=()=>reject(request.error)});
   await new Promise((resolve,reject)=>{const request=indexedDB.open('recall',1);request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('videos',{keyPath:'videoId'});db.createObjectStore('chunks',{keyPath:'id',autoIncrement:true}).createIndex('videoId','videoId')};request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction(['videos','chunks'],'readwrite');tx.objectStore('videos').put({videoId:'zzzzzzzzzzz',title:'Existing library',method:'captions',chunkCount:1,indexedAt:Date.now()});tx.objectStore('chunks').put({videoId:'zzzzzzzzzzz',start:77,text:'Preserved existing transcript',vec:new Float32Array(384)});tx.oncomplete=()=>{db.close();resolve()}}});
  });
  options=await context.newPage();await options.goto(`${base}/options/options.html`);
  const legacy=await options.evaluate(()=>chrome.runtime.sendMessage({type:'export'}));assert.equal(legacy.videos[0].chunks[0].start,77);assert.equal(legacy.videos[0].chunks[0].text,'Preserved existing transcript');
  await options.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,dwellSeconds:0,maxAgeDays:0,speechEnabled:false,screenTextEnabled:false,scenesEnabled:true}}));
  const wait=async predicate=>{const deadline=Date.now()+180000;do{const value=await predicate();if(value)return value;await new Promise(r=>setTimeout(r,200))}while(Date.now()<deadline);throw Error('Scene browser test timed out')};
  const cat=await context.newPage();await cat.goto('https://www.youtube.com/watch?v=aaaaaaaaaaa');await cat.locator('#play').click();
  await wait(async()=>{const r=await options.evaluate(()=>chrome.runtime.sendMessage({type:'list'}));return r.videos.find(v=>v.videoId==='aaaaaaaaaaa'&&v.sceneCount>0)});
  await cat.evaluate(()=>document.querySelector('video').pause());
  const previous=(await options.evaluate(()=>chrome.runtime.sendMessage({type:'list'}))).videos.find(video=>video.videoId==='aaaaaaaaaaa');assert.equal(previous.historyImported,false);
  await cat.evaluate(()=>{history.pushState({},'','/');document.dispatchEvent(new Event('yt-navigate-finish'))});
  await cat.evaluate(()=>{history.pushState({},'','/watch?v=aaaaaaaaaaa');document.dispatchEvent(new Event('yt-navigate-finish'));document.querySelector('video').play()});
  await wait(async()=>{const data=await options.evaluate(()=>chrome.runtime.sendMessage({type:'list'}));return data.videos.find(video=>video.videoId==='aaaaaaaaaaa'&&video.watchedAt>previous.watchedAt)});
  await cat.evaluate(()=>document.querySelector('video').pause());
  const battery=await context.newPage();await battery.goto('https://www.youtube.com/watch?v=bbbbbbbbbbb');await battery.locator('#play').click();
  await wait(async()=>{const r=await options.evaluate(()=>chrome.runtime.sendMessage({type:'list'}));return r.videos.find(v=>v.videoId==='bbbbbbbbbbb'&&v.sceneCount>0&&v.method!=='history-title')});
  await battery.evaluate(()=>document.querySelector('video').pause());
  const visual=await options.evaluate(()=>chrome.runtime.sendMessage({type:'search',query:'two cats sitting on a sofa',singleVideo:true}));
  console.log('SCENE_RESULTS',JSON.stringify(visual.results.map(({videoId,start,matchSources,score,scene})=>({videoId,start,matchSources,score,scene}))));
  assert.equal(visual.results[0].videoId,'aaaaaaaaaaa');assert.ok(visual.results[0].matchSources.includes('Scene'));assert.ok(visual.results[0].image.startsWith('data:image/jpeg;base64,'));assert.ok(visual.results[0].start>0);
  const spoken=await options.evaluate(()=>chrome.runtime.sendMessage({type:'search',query:'why phone batteries store less charge after repeated charging',singleVideo:true}));
  assert.equal(spoken.results[0].videoId,'bbbbbbbbbbb');assert.equal(spoken.results[0].start,42);assert.ok(spoken.results[0].matchSources.includes('Transcript'));
  const another=await context.newPage();await another.goto('https://www.youtube.com/watch?v=eeeeeeeeeee');await another.locator('#play').click();
  await wait(async()=>{const r=await options.evaluate(()=>chrome.runtime.sendMessage({type:'list'}));return r.videos.find(v=>v.videoId==='eeeeeeeeeee'&&v.sceneCount>0)});
  await another.evaluate(()=>document.querySelector('video').pause());
  const popup=await context.newPage();await popup.goto(`${base}/popup/popup.html`);assert.equal(await popup.locator('#search-mode').count(),0);
  await popup.locator('#q').fill('two cats sitting on a sofa');
  await wait(async()=>await popup.locator('.result .match-sources').first().textContent().catch(()=>''));
  assert.match(await popup.locator('.result .match-sources').first().textContent(),/Scene/);assert.match(await popup.locator('.result').first().getAttribute('href'),/v=aaaaaaaaaaa&t=\d+s/);
  assert.ok((await popup.locator('.result img').first().getAttribute('src')).startsWith('data:image/jpeg'));
  await popup.screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR||os.tmpdir(),'recall-scenes-light.png'),fullPage:true});
  await popup.emulateMedia({colorScheme:'dark'});await popup.screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR||os.tmpdir(),'recall-scenes-dark.png'),fullPage:true});
  assert.equal(await popup.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await popup.locator('#next-video').click();await wait(async()=>!(await popup.locator('.result').first().getAttribute('href')).includes('v=aaaaaaaaaaa'));
  await popup.locator('#previous-video').click();await wait(async()=>(await popup.locator('.result').first().getAttribute('href')).includes('v=aaaaaaaaaaa'));
  const backup=await options.evaluate(()=>chrome.runtime.sendMessage({type:'export'}));assert.equal(backup.scenes.length,3);
  await options.evaluate(async()=>{const clear=await chrome.runtime.sendMessage({type:'clear'});if(clear.error)throw Error(clear.error);const send=chrome.runtime.sendMessage.bind(chrome.runtime);window.restoreCalls=[];chrome.runtime.sendMessage=msg=>{if(msg.type==='import')restoreCalls.push({videos:msg.data.videos.length,scenes:msg.data.scenes?.length||0});return send(msg)};});
  await options.locator('#import').setInputFiles({name:'recall-test-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await options.waitForFunction(count=>document.querySelector('#data-msg').textContent==='Imported '+count+' videos.',backup.videos.length);
  const calls=await options.evaluate(()=>restoreCalls);assert.equal(calls.length,backup.videos.length+backup.scenes.length);assert.ok(calls.every(call=>call.videos+call.scenes===1));
  const after=await options.evaluate(()=>chrome.runtime.sendMessage({type:'search',query:'two cats sitting on a sofa',singleVideo:true}));assert.equal(after.results[0].videoId,'aaaaaaaaaaa');assert.ok(after.results[0].matchSources.includes('Scene'));
  const limits=await options.evaluate(async image=>{
   const db=await import(chrome.runtime.getURL('lib/db.js'));await db.clearAll();const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;canvas.getContext('2d').fillRect(0,0,320,180);image=canvas.toDataURL('image/jpeg',.6);
   const request=indexedDB.open('recall',5),database=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
   const tx=database.transaction(['videos','scenes'],'readwrite'),vs=tx.objectStore('videos'),ss=tx.objectStore('scenes');
   for(const [videoId,count] of [['ccccccccccc',250],['ddddddddddd',1780]]){vs.put({videoId,title:'Capacity test',method:'history-title',sceneCount:count});for(let i=0;i<count;i++)ss.put({key:videoId+':'+i,videoId,start:i*20,indexedAt:videoId[0]==='c'?10000+i:i,image,vec:new Float32Array(512)})}
   await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});database.close();
   await db.scenes.put({key:'ccccccccccc:250',videoId:'ccccccccccc',start:5000,indexedAt:20000,image,vec:new Float32Array(512)});
   const all=await db.scenes.vectors(),own=(await db.getVideo('ccccccccccc')).sceneCount,other=(await db.getVideo('ddddddddddd')).sceneCount;
   const pruned=await db.scenes.prune(30000),remaining=(await db.scenes.all()).length;
   await db.scenes.put({key:'ccccccccccc:1',videoId:'ccccccccccc',start:20,indexedAt:40000,image,vec:new Float32Array(512)});await db.deleteVideo('ccccccccccc');
   return {total:all.length,own,other,pruned,remaining,afterDelete:(await db.scenes.all()).length};
  },image);
  assert.deepEqual(limits,{total:2000,own:240,other:1760,pruned:2000,remaining:0,afterDelete:0});
  const retention=await options.evaluate(async image=>{
   const db=await import(chrome.runtime.getURL('lib/db.js')),old=Date.now()-90*864e5;
   await db.replaceVideo({videoId:'fffffffffff',title:'Watched scene only',method:'history-title',historyImported:false,indexedAt:old,watchedAt:old},[]);
   await db.scenes.put({key:'fffffffffff:1',videoId:'fffffffffff',start:20,indexedAt:old,watchedAt:old,image,vec:new Float32Array(512)});
   await db.replaceVideo({videoId:'ggggggggggg',title:'Imported title',method:'history-title',historyImported:true,indexedAt:old,watchedAt:old},[]);
   await chrome.storage.local.set({settings:{enabled:false,maxAgeDays:30,speechEnabled:false,screenTextEnabled:false,scenesEnabled:false}});
   const result=await chrome.runtime.sendMessage({type:'prune'});return {error:result.error,watched:!!await db.getVideo('fffffffffff'),imported:!!await db.getVideo('ggggggggggg'),scenes:(await db.scenes.all()).some(scene=>scene.videoId==='fffffffffff')};
  },image);assert.deepEqual(retention,{error:undefined,watched:false,imported:true,scenes:false});
  assert.deepEqual(errors,[]);
  console.log('SCENES_PASS: v1 migration, automatic player frames, real CLIP+MiniLM unified search, evidence indicators, preserved spoken timestamps, previews/arrows, backup restore, caps, retention and deletion. Video pages controlled.');
 } finally {await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
