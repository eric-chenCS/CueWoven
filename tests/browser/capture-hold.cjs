const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright'),fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-capture-hold-')),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 try{
  const worker=browser.serviceWorkers()[0]||await browser.waitForEvent('serviceworker'),page=await browser.newPage();await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/options/options.html`);
  const race=await page.evaluate(async()=>{
   await chrome.storage.local.set({settings:{enabled:false,maxAgeDays:0,speechEnabled:false,scenesEnabled:false,screenTextEnabled:false}});
   const db=await import(chrome.runtime.getURL('lib/db.js')),canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;canvas.getContext('2d').fillRect(0,0,320,180);const image=canvas.toDataURL('image/jpeg',.6),videoId='aaaaaaaaaaa';
   await db.replaceVideo({videoId,title:'Scene restore race',method:'captions',chunkCount:1,indexedAt:Date.now()},[{videoId,start:20,text:'A sample video frame',vec:new Float32Array(384),embeddingVersion:'minilm-l6-v2-body-v2'}]);
   await db.scenes.put({key:videoId+':1',videoId,start:20,image,vec:new Float32Array(512),indexedAt:Date.now()});
   const send=chrome.runtime.sendMessage.bind(chrome.runtime);await send({type:'warmup',scenes:false});
   let restore=null,triggered=false;const listener=msg=>{if(msg.type==='vision-state' && msg.state?.status==='working' && msg.state.operation==='text' && !triggered){triggered=true;restore=send({type:'import',data:{format:'recall-export',videos:[],scenes:[{videoId,start:20,image,indexedAt:Date.now()}]}})}};chrome.runtime.onMessage.addListener(listener);
   try{const search=await send({type:'search',query:'a video scene with a dark picture'});return {triggered,restore:restore?await restore:null,searchError:search.error,sceneError:search.sceneError};}finally{chrome.runtime.onMessage.removeListener(listener)}
  });assert.equal(race.triggered,true);assert.equal(race.restore.imported,0);assert.equal(race.restore.error,undefined);console.log('RESTORE_DURING_SEARCH',JSON.stringify(race));
  const concurrency=await page.evaluate(async()=>{
   const send=chrome.runtime.sendMessage.bind(chrome.runtime),db=await import(chrome.runtime.getURL('lib/db.js')),canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;canvas.getContext('2d').fillRect(0,0,320,180);const image=canvas.toDataURL('image/jpeg',.6);
   let action;const listener=msg=>{if(msg.type==='vision-state'&&msg.state?.status==='working'&&msg.state.operation==='text'&&!action){action=(async()=>{const restore=send({target:'offscreen',type:'import',data:{format:'recall-export',videos:[],scenes:[{videoId:'aaaaaaaaaaa',start:40,image}]}});const clear=send({target:'offscreen',type:'clear'});return {restore:await restore,clear:await clear};})()}};chrome.runtime.onMessage.addListener(listener);
   try{await send({type:'search',query:'another dark image query'});return await action;}finally{chrome.runtime.onMessage.removeListener(listener)}
  });assert.equal(concurrency.restore.error,undefined);assert.match(concurrency.clear.error,/backup restore/);console.log('EXCLUSIVE_RESTORE',JSON.stringify(concurrency));
  const cancellation=await page.evaluate(async()=>{
   const db=await import(chrome.runtime.getURL('lib/db.js')),send=chrome.runtime.sendMessage.bind(chrome.runtime),canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d');ctx.fillStyle='#345b78';ctx.fillRect(0,0,1280,720);ctx.fillStyle='#111';ctx.fillRect(100,560,1080,130);ctx.fillStyle='white';ctx.font='bold 38px Arial';ctx.fillText('Chemical reactions trap lithium.',160,615);const image=canvas.toDataURL('image/jpeg',.95);
   const output=[];
   for(const type of ['delete','clear']){
    let action;const listener=msg=>{if(msg.type==='ocr-state'&&msg.state?.status==='working'&&!action)action=send({type,videoId:'bbbbbbbbbbb'});};chrome.runtime.onMessage.addListener(listener);
    try{const capture=await send({target:'offscreen',type:'screen-index',video:{videoId:'bbbbbbbbbbb',title:'Canceled frame'},start:42,image});if(!action)throw Error('OCR did not reach working state');const changed=await action;output.push({type,capture,changed,video:!!await db.getVideo('bbbbbbbbbbb'),rows:(await db.screenText.all()).filter(row=>row.videoId==='bbbbbbbbbbb').length});}finally{chrome.runtime.onMessage.removeListener(listener)}
   }
   const resumed=await send({target:'offscreen',type:'screen-index',video:{videoId:'bbbbbbbbbbb',title:'New watched frame'},start:60,image});return {output,resumed,rows:(await db.screenText.all()).length};
  });for(const result of cancellation.output){assert.equal(result.changed.ok,true);assert.equal(result.capture.disabled,true);assert.equal(result.video,false);assert.equal(result.rows,0);}assert.equal(cancellation.resumed.ok,true);assert.equal(cancellation.rows,1);console.log('CAPTURE_CANCELLATION',JSON.stringify(cancellation));
  console.log('CAPTURE_HOLD_PASS: real scene-query restore, concurrent restore/clear exclusion, OCR delete/clear cancellation and later capture resume.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
