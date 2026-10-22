const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const f=await fixture(),report={checks:[]},lateRequests=new Map();
 try{
  await f.options.evaluate(()=>chrome.storage.local.set({onboardingComplete:true,liteModeInitialized:true,settings:{enabled:true,lightMode:true,dwellSeconds:0,maxAgeDays:0}}));
  await f.send({type:'status'});
  await f.context.route('https://www.youtube.com/**',route=>{
   const url=new URL(route.request().url()),id=url.searchParams.get('v');
   if(url.pathname==='/api/timedtext'){
    let body='';
    if(url.searchParams.has('late')){const uses=lateRequests.get(id)||0;lateRequests.set(id,uses+1);if(!uses)body=JSON.stringify({events:[0,1,2].map(i=>({tStartMs:(40+i*5)*1000,segs:[{utf8:['Neurons recognize handwritten digits despite their different shapes.','Seeing the same number activates a different pattern of neurons.','A neural network learns these patterns from many examples.'][i]}]}))});}
    return route.fulfill({contentType:'application/json',body});
   }
   if(url.pathname!=='/watch')return route.fulfill({status:404,body:''});
   const player={videoDetails:{videoId:id,title:'Delayed neural network lesson',lengthSeconds:'500'},captions:{playerCaptionsTracklistRenderer:{captionTracks:[{languageCode:'en',baseUrl:'https://www.youtube.com/api/timedtext?v='+id}]}}};
   return route.fulfill({contentType:'text/html',body:`<!doctype html><title>Delayed neural network lesson</title><script>window.ytInitialPlayerResponse=${JSON.stringify(player)}</script><h1>Delayed neural network lesson</h1><button id="late" onclick="fetch('/api/timedtext?v=${id}&late=1')">Load late player captions</button>`});
  });
  const load=async id=>{
   const page=await f.context.newPage();await page.goto('https://www.youtube.com/watch?v='+id);
   const tabId=await f.worker.evaluate(async id=>(await chrome.tabs.query({url:'https://www.youtube.com/watch?v='+id}))[0].id,id);
   await f.wait(async()=>f.worker.evaluate(async tabId=>(await chrome.tabs.sendMessage(tabId,{type:'get-video'})).textCapture==='captions-unavailable',tabId));
   const saved=(await f.send({type:'list'})).videos.find(video=>video.videoId===id);assert.equal(saved.method,'history-title');
   return page;
  };
  const page=await load('latecap0001');await page.locator('#late').click();
  await f.wait(async()=>(await f.send({type:'list'})).videos.some(video=>video.videoId==='latecap0001'&&video.method==='player-captions'));
  const result=await f.send({type:'search',query:'"Neurons recognize handwritten digits"',videoId:'latecap0001'});
  assert.equal(result.error,undefined);assert.equal(result.results[0].videoId,'latecap0001');assert.deepEqual(result.results[0].matchSources,['Transcript']);assert.equal(result.results[0].start,40);assert.equal(lateRequests.get('latecap0001'),1,'cached one-use response must not be replayed');
  report.checks.push('initial title-only capture automatically upgrades from a late native player response; real MiniLM finds Transcript at 40s');
  const paused=await load('latecap0002');await f.options.evaluate(async()=>{const {settings}=await chrome.storage.local.get('settings');await chrome.storage.local.set({settings:{...settings,enabled:false}});});
  await paused.locator('#late').click();await paused.waitForTimeout(500);
  assert.equal((await f.send({type:'list'})).videos.find(video=>video.videoId==='latecap0002').method,'history-title');
  report.checks.push('pausing saving before late captions arrive prevents the upgrade');report.pass=true;
  console.log('LATE_CAPTIONS_PASS',JSON.stringify(report));
 }catch(error){report.error=error.stack;throw error;}
 finally{if(process.env.RECALL_REPORT_DIR){fs.mkdirSync(process.env.RECALL_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR,'late-captions.json'),JSON.stringify(report,null,2));}await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
