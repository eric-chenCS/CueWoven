const fixture=require('./web-fixture.cjs'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{
 const f=await fixture(),errors=[];
 f.context.on('weberror',event=>errors.push(event.error().message));
 try{
  await f.send({type:'clear'});
  const popup=await f.context.newPage();await popup.goto(f.base+'/popup/popup.html');
  await popup.locator('#start-samples').click();await popup.waitForFunction(()=>document.querySelector('#q').value==='why do batteries wear out');await popup.locator('#q').press('Enter');
  await f.wait(async()=>(await f.send({type:'list'})).videos.length===5);
  await popup.waitForFunction(()=>document.querySelector('.result .title')?.textContent.includes('batteries'));
  if(process.env.RECALL_SCREENSHOT_DIR)await popup.locator('body').screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR,'recall-v3.3.0-samples.png')});
  const sampleUrl=await popup.locator('.best .result').getAttribute('href');
  assert.ok(sampleUrl.startsWith(f.base+'/samples/player.html?id=rcDemo00001&t='));
  await popup.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.copiedLink=text}});});
  await popup.locator('.best .copy-link').click();assert.equal(await popup.evaluate(()=>window.copiedLink),sampleUrl);
  const player=await f.context.newPage();await player.goto(f.base+'/samples/player.html?id=rcDemo00001&t=8');
  await player.waitForFunction(()=>document.querySelector('video').readyState>=2&&document.querySelector('video').currentTime>=7.9);
  assert.match(await player.locator('#caption').textContent(),/Repeated charging/);
  await player.close();
  const backup=await f.send({type:'export'});await f.send({type:'clear'});
  assert.equal((await f.send({type:'import',data:backup})).error,undefined);
  assert.equal((await f.send({type:'search',query:'batteries charging lose capacity'})).results[0].sample,true);
  // Use a controlled active-video context, while the real engine indexes and filters.
  await f.send({type:'clear'});
  await f.options.evaluate(async()=>{
   await chrome.storage.local.set({settings:{enabled:true,maxAgeDays:0}});
   for(const videoId of ['aaaaaaaaaaa','bbbbbbbbbbb']){
    const saved=await chrome.runtime.sendMessage({target:'offscreen',type:'index',video:{videoId,title:videoId==='aaaaaaaaaaa'?'Current video':'Another video',watchedAt:Date.now()},segments:[{start:42,text:'Coral bleaching happens when warm ocean water drives away algae.'}],method:'controlled-test'});
    if(saved.error)throw Error(saved.error);
   }
   await chrome.storage.local.set({settings:{enabled:false,maxAgeDays:0}});
  });
  await f.context.addInitScript(()=>{
   if(!location.pathname.endsWith('/popup/popup.html'))return;
   chrome.tabs.query=async()=>[{id:99,url:'https://www.youtube.com/watch?v=aaaaaaaaaaa',title:'Current video'}];
   chrome.tabs.sendMessage=async()=>({video:{videoId:'aaaaaaaaaaa',title:'Current video'}});
  });
  await popup.reload();await popup.locator('#video-scope').check();await popup.locator('#q').fill('warm ocean algae');await popup.locator('#q').press('Enter');
  await popup.waitForFunction(()=>document.querySelector('.result')?.href.includes('v=aaaaaaaaaaa'));
  await popup.waitForFunction(()=>document.querySelectorAll('.result').length===1,'searching one video shows only that video');
  assert.ok((await popup.locator('.result').getAttribute('href')).includes('&t=42s'));
  // Fresh current videos are indexed automatically before their first scoped search.
  await f.options.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,maxAgeDays:0}}));
  await f.send({type:'delete',videoId:'aaaaaaaaaaa'});
  await popup.evaluate(()=>{
   const original=chrome.runtime.sendMessage.bind(chrome.runtime);
   chrome.runtime.sendMessage=async msg=>{
    if(msg.type==='index-tab'){
     window.autoIndexCalls=(window.autoIndexCalls||0)+1;
     const indexed=await original({target:'offscreen',type:'index',video:{videoId:'aaaaaaaaaaa',title:'Current video',watchedAt:Date.now()},segments:[{start:64,text:'Warm ocean algae explain coral bleaching in this current video.'}],method:'controlled-test'});
     return {ok:!indexed.error,...indexed};
    }
    return original(msg);
   };
  });
  await popup.locator('#q').fill('coral bleaching current');await popup.locator('#q').press('Enter');
  await popup.waitForFunction(()=>document.querySelector('.result')?.href.includes('&t=64s'));
  assert.equal(await popup.evaluate(()=>window.autoIndexCalls),1);
  // A hung transport settles into Retry instead of an indefinite spinner.
  await popup.evaluate(()=>{
   const original=chrome.runtime.sendMessage.bind(chrome.runtime);
   chrome.runtime.sendMessage=msg=>msg.type==='search'&&msg.query==='hold forever'?new Promise(resolve=>window.finishHeld=resolve):original(msg);
  });
  await popup.locator('#q').fill('hold forever');await popup.locator('#q').press('Enter');
  await popup.locator('#search-retry').waitFor({state:'visible',timeout:15000});
  await popup.locator('#q').fill('coral bleaching');await popup.locator('#q').press('Enter');
  await popup.waitForFunction(()=>document.querySelector('.result')?.href.includes('v=aaaaaaaaaaa'));
  await popup.evaluate(()=>window.finishHeld({results:[]}));await popup.waitForTimeout(100);
  assert.equal(await popup.locator('.result').count(),1);
  await popup.locator('#q').fill('coral recently');await popup.locator('#q').press('Enter');await popup.locator('.chip[data-days="7"]').click();
  assert.equal(await popup.locator('.chip[data-days="7"]').getAttribute('aria-checked'),'true');
  // Light mode preserves individual preferences and immediately gates all media captures.
  await f.options.locator('#lightMode').check();
  await f.wait(()=>f.options.evaluate(async()=>!!(await chrome.storage.local.get('settings')).settings.lightMode));
  assert.equal(await f.options.locator('#scenesEnabled').isDisabled(),true);
  assert.deepEqual(await f.send({type:'scene-frame'}),{disabled:true});
  assert.deepEqual(await f.send({type:'screen-frame'}),{disabled:true});
  assert.deepEqual(await f.send({type:'speech-auto-start'}),{disabled:true});
  // Visible sign-out pages are private; hidden controls do not block public text.
  await f.enable();
  await f.context.route('https://www.example.com/**',route=>route.fulfill({contentType:'text/html',body:'<title>Public coral article</title><article><p>Coral reefs need clear water and sunlight. Contact reader@example.com, phone (212) 555-0199, card 4111 1111 1111 1111, SSN 123-45-6789.</p></article><a href="/logout">Sign out</a>'}));
  const article=await f.context.newPage();await article.goto('https://www.example.com/public');await article.waitForTimeout(6000);
  assert.equal((await f.send({type:'list'})).videos.some(row=>row.url==='https://www.example.com/public'),false);
  await article.locator('a').evaluate(node=>node.hidden=true);
  const tabs=await f.worker.evaluate(()=>chrome.tabs.query({})),tab=tabs.find(tab=>tab.url==='https://www.example.com/public');
  const saved=await f.worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'index-now'}),tab.id);assert.equal(saved.ok,true);
  const exported=JSON.stringify(await f.send({type:'export'}));
  for(const secret of ['reader@example.com','555-0199','4111 1111','123-45-6789'])assert.ok(!exported.includes(secret));
  assert.ok(exported.includes('[email redacted]'));
  assert.equal(await f.worker.evaluate(id=>chrome.action.getBadgeText({tabId:id}),tab.id),'•');
  await article.close();await f.options.bringToFront();
  // Explicit opt-in remains available for live Google-query capture.
  await f.options.locator('details').filter({has:f.options.locator('#web-searches')}).locator('summary').first().click();
  await f.options.locator('#web-searches').check();
  await f.wait(()=>f.options.evaluate(async()=>(await chrome.storage.local.get('webCapture')).webCapture.searches===true));
  // Forget recent honors save time, not the years-old date of an imported visit.
  await f.send({type:'clear'});
  await f.options.evaluate(async()=>{
   const db=await import(chrome.runtime.getURL('lib/db.js'));
   for(const [videoId,savedAt] of [['old00000000',Date.now()-2*864e5],['new00000000',Date.now()]])await db.replaceVideo({videoId,title:'Remember '+videoId,method:'captions',watchedAt:1e12,indexedAt:1e12,savedAt,chunkCount:1},[{videoId,start:20,text:'Saved memory evidence',vec:new Float32Array(384)}]);
  });
  const forgotten=await f.send({type:'forget-recent',hours:24});assert.equal(forgotten.removed,1);
  assert.deepEqual((await f.send({type:'list'})).videos.map(row=>row.videoId),['old00000000']);
  assert.equal((await f.send({type:'search',query:'new00000000'})).results.some(hit=>hit.videoId==='new00000000'),false);
  if(process.env.RECALL_SCREENSHOT_DIR){await popup.locator('#video-scope').uncheck();await popup.locator('#q').fill('saved memory evidence');await popup.locator('#q').press('Enter');await popup.locator('.chip[data-days="0"]').click();await popup.locator('.result').waitFor();assert.ok((await popup.locator('.result').boundingBox()).height>50);await popup.locator('body').screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR,'recall-v3.3.0-popup.png')});}
  assert.deepEqual(errors,[]);
  console.log('V33_FEATURES_PASS',JSON.stringify({samples:5,playableSamples:true,copyLink:true,scope:true,indexBeforeSearch:true,timeoutAndStaleReply:true,suggestedWeekOptIn:true,lightMode:true,signoutAndRedaction:true,toolbarDot:true,searchConsent:true,forgetBySaveDate:true}));
 }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
