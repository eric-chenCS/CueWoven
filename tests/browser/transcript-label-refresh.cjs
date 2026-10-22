const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const f=await fixture(),report={checks:[]};
 const checked=async msg=>{const result=await f.send(msg);assert.equal(result.error,undefined,JSON.stringify(result));return result;};
 try{
  await f.options.evaluate(()=>chrome.storage.local.set({onboardingComplete:true,liteModeInitialized:true,settings:{enabled:true,lightMode:true,maxAgeDays:0}}));
  await checked({type:'status'});
  for(const previous of ['history-title','speech-local']){
   await checked({type:'clear'});
   const video={videoId:'label000001',title:'Coral reef research',channel:'Marine biology',watchedAt:Date.now()-1000};
   await checked({target:'offscreen',type:'import-history',videos:[video],historyImported:false});
   if(previous==='speech-local')await checked({target:'offscreen',type:'index',video,method:previous,segments:[{start:20,text:'Coral reef research explains marine biology.'}]});
   await checked({target:'offscreen',type:'touch-watch',videoId:video.videoId,watchedAt:Date.now()});
   const old=(await checked({type:'search',query:'Coral reef research'})).results.find(hit=>hit.videoId===video.videoId);assert.ok(old);assert.equal(old.titleOnly,previous==='history-title');
   const query='Coral bleaching happens when ocean heat drives symbiotic algae away.';
   await checked({target:'offscreen',type:'index',video,method:'transcript-panel',segments:[{start:75,text:query}]});
   for(let retry=0;retry<2;retry++){
    const found=(await checked({type:'search',query})).results.find(hit=>hit.videoId===video.videoId);assert.ok(found);
    assert.equal(found.titleOnly,false,previous+' must be replaced by transcript metadata');assert.equal(found.speechGenerated,false);assert.deepEqual(found.matchSources,['Transcript']);assert.equal(found.start,75);assert.equal(found.text,query);
    const link=await f.options.evaluate(async hit=>(await import(chrome.runtime.getURL('lib/result-link.js'))).resultLink(hit),found);
    assert.equal(new URL(link).searchParams.get('t'),'75s','transcript results must open at the matched timestamp');
    if(!retry)await checked({target:'offscreen',type:'touch-watch',videoId:video.videoId,watchedAt:Date.now()});
   }
   report.checks.push(previous+' upgrade: fresh and repeated searches use Transcript labels and timestamp links');
  }
  report.pass=true;report.browser=await f.context.browser().version();console.log('TRANSCRIPT_LABEL_REFRESH_PASS',JSON.stringify(report));
 }catch(error){report.error=error.stack;throw error;}
 finally{if(process.env.RECALL_REPORT_DIR){fs.mkdirSync(process.env.RECALL_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR,'transcript-label-refresh.json'),JSON.stringify(report,null,2));}await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
