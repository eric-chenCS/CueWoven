const fixture=require('./web-fixture.cjs'),assert=require('assert/strict'),path=require('path');
(async()=>{const f=await fixture(),errors=[];let release,requested=false,requestAt=0;
 const gate=new Promise(r=>release=r);f.context.on('weberror',e=>errors.push(e.error().message));
 try{
 await f.options.evaluate(()=>chrome.storage.local.set({onboardingComplete:true,settings:{enabled:true,maxAgeDays:0,speechEnabled:false,scenesEnabled:false,screenTextEnabled:false,articleImagesEnabled:false}}));
 assert.equal((await f.send({type:'warmup'})).error,undefined);
 await f.context.route('https://www.youtube.com/**',async route=>{
  const u=new URL(route.request().url()),id=u.searchParams.get('v');
  if(u.pathname==='/watch')return route.fulfill({contentType:'text/html',body:`<!doctype html><title>Progress fixture</title><script>window.ytInitialPlayerResponse={videoDetails:{videoId:'${id}',title:'Progress fixture',author:'Fixture',lengthSeconds:'300'},captions:{playerCaptionsTracklistRenderer:{captionTracks:[{languageCode:'en',baseUrl:'https://www.youtube.com/api/timedtext?v=${id}'}]}}};</script><h1>Controlled caption fixture</h1>`});
  if(u.pathname==='/api/timedtext'){
   if(id==='aaaaaaaaaaa'){requested=true;requestAt=Date.now();await gate;return route.fulfill({contentType:'application/json',body:JSON.stringify({events:[{tStartMs:0,dDurationMs:8000,segs:[{utf8:'I got a bad back. I take my back brace off.'}]},{tStartMs:8000,dDurationMs:8000,segs:[{utf8:'Aging is not fun. Welcome to getting older.'}]},{tStartMs:16000,dDurationMs:8000,segs:[{utf8:'Welcome to the new channel. I am pushing forty.'}]}]})});}
   return route.fulfill({status:500,body:'Controlled caption failure'});
  }
  return route.fulfill({status:404,body:''});
 });
 const video=await f.context.newPage(),began=Date.now();await video.goto('https://www.youtube.com/watch?v=aaaaaaaaaaa');
 await f.wait(()=>requested);assert.ok(requestAt-began>=9000,'fresh install waits roughly 10 seconds before fetching captions');
 const target=(await f.worker.evaluate(()=>chrome.tabs.query({url:'https://www.youtube.com/watch*'})))[0];
 await f.context.addInitScript(target=>{if(location.pathname.endsWith('/popup/popup.html')){const query=chrome.tabs.query.bind(chrome.tabs);chrome.tabs.query=q=>q.active?Promise.resolve([target]):query(q)}},target);
 const popup=await f.context.newPage();await popup.goto(f.base+'/popup/popup.html');
 await popup.locator('#capture-indicator').filter({hasText:'Preparing searchable text…'}).waitFor({state:'visible'});
 await popup.setViewportSize({width:440,height:600});
 await popup.screenshot({path:path.join(process.env.RECALL_REPORT_DIR||process.env.RECALL_TEST_ROOT,'cuewoven-preparing-text.png'),fullPage:true});
 const titleOnly=await f.send({target:'offscreen',type:'has',videoId:'aaaaaaaaaaa'});assert.equal(titleOnly.textContent,false,'a saved title is not ready spoken text');
 release();await popup.waitForFunction(()=>document.querySelector('#capture-indicator').textContent==='Saved on this device');
 const search=await f.send({type:'search',query:'speaker getting older with a bad back'});assert.equal(search.results[0].videoId,'aaaaaaaaaaa');
 console.log('CAPTION_SUCCESS_PASS',JSON.stringify({delayMs:requestAt-began,status:'Preparing searchable text… → Saved on this device',search:search.results[0].videoId}));
 await f.options.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,dwellSeconds:0,speechEnabled:false,scenesEnabled:false,screenTextEnabled:false}}));
 await video.bringToFront();await video.goto('https://www.youtube.com/watch?v=bbbbbbbbbbb');
 await f.wait(async()=>{const r=await popup.evaluate(tabId=>chrome.runtime.sendMessage({type:'capture-status',tabId}),target.id);return r.reason==='captions-unavailable';});
 await popup.bringToFront();await popup.waitForFunction(()=>document.querySelector('#capture-indicator').textContent.includes('Captions unavailable'));
 await popup.reload();await popup.waitForFunction(()=>document.querySelector('#capture-indicator').textContent.includes('Captions unavailable'));
 await f.options.evaluate(()=>chrome.storage.local.set({settings:{enabled:false}}));await popup.waitForFunction(()=>document.querySelector('#capture-indicator').textContent==='Capture is paused');
 await f.options.evaluate(()=>chrome.storage.local.set({settings:{enabled:true},webCapture:{blocked:['youtube.com']}}));await popup.waitForFunction(()=>document.querySelector('#capture-indicator').textContent==='This address or site is excluded');
 console.log('CAPTION_FAILURE_REOPEN_PAUSE_EXCLUSION_PASS');assert.deepEqual(errors,[]);
 }finally{release();await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
