// Deliberately crashes an isolated extension renderer; verifies persisted retrieval after restart.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const repo=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..'),out=process.env.RECALL_REPORT_DIR;process.env.RECALL_EXTENSION=repo;
const report={started:new Date().toISOString()},save=()=>{if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'renderer-recovery.json'),JSON.stringify(report,null,2));}};
(async()=>{
 const f=await require(path.join(repo,'tests/browser/web-fixture.cjs'))({prepareExtension(extension){report.profile=path.dirname(extension);}});let restarted;
 try{
  await f.enable();await f.options.evaluate(()=>chrome.storage.local.set({settings:{enabled:true,maxAgeDays:0,lightMode:true},liteModeInitialized:true}));
  const indexed=await f.send({target:'offscreen',type:'index',video:{videoId:'crash000001',title:'Coral recovery',channel:'Fixture',watchedAt:Date.now()},segments:[{start:42,text:'Ocean warming makes coral turn pale when heat stress causes it to lose the algae that provide food.'}],method:'captions'});assert.equal(indexed.error,undefined);
  const before=await f.send({type:'search',query:'why coral turns pale after ocean warming',distinct:true,inferFilters:false});assert.equal(before.results[0].videoId,'crash000001');
  const browserCdp=await f.context.browser().newBrowserCDPSession();await browserCdp.send('Target.setDiscoverTargets',{discover:true});browserCdp.on('Target.targetCrashed',e=>{(report.crashes??=[]).push(e);save();});
  const {targetInfos}=await browserCdp.send('Target.getTargets'),target=targetInfos.find(t=>t.url===f.base+'/offscreen/offscreen.html');assert.ok(target);
  const {sessionId}=await browserCdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
  await browserCdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:1,method:'Page.crash'})});
  await f.wait(()=>!!report.crashes?.length);save();
  let fresh=await f.context.newPage();
  try{await fresh.goto(f.base+'/options/options.html');report.automaticRecovery=true;}
  catch(e){
   if(!String(e.message).includes('ERR_BLOCKED_BY_CLIENT'))throw e;
   report.automaticRecovery=false;report.browserBlockedExtension=true;save();await f.close();
   const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright'),extension=path.join(report.profile,'extension');
   restarted=await chromium.launchPersistentContext(path.join(report.profile,'profile'),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
   fresh=await restarted.newPage();await fresh.goto(f.base+'/options/options.html');
  }
  const start=performance.now(),after=await fresh.evaluate(()=>chrome.runtime.sendMessage({type:'search',query:'why coral turns pale after ocean warming',distinct:true,inferFilters:false}));report.after=after;report.recoveryMs=performance.now()-start;save();
  assert.equal(after.error,undefined);assert.deepEqual(after.results,before.results);report.durabilityPass=true;report.pass=true;console.log('RENDERER_DURABILITY_PASS');
 }finally{await restarted?.close();await f.close();save();}
})().catch(e=>{report.error=e.stack;save();console.error(e);process.exitCode=1;});
