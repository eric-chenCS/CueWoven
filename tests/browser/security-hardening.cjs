const fixture=require('./web-fixture.cjs'),assert=require('assert/strict');
(async()=>{
 const f=await fixture(),errors=[];
 f.context.on('weberror',event=>errors.push(event.error().message));
 try{
  const secret='sk-'+'a'.repeat(30);
  await f.context.route('https://example.com/**',route=>{
   const url=new URL(route.request().url());
   return route.fulfill({contentType:'text/html',body:`<!doctype html><title>Coral science</title><article ${url.pathname==='/private'?'data-private':''}><h1>Coral reef biology</h1><p>Coral bleaching occurs when warm ocean water drives symbiotic algae away. Marine biologists study ocean temperature and coral recovery. ${secret} Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456</p>${url.pathname==='/payment'?'<input autocomplete="cc-number">':''}</article>`});
  });
  await f.enable();
  assert.ok(!(await f.send({type:'status'})).error,'service-worker messages reach offscreen');
  const page=await f.context.newPage();await page.goto('https://example.com/article?state=CA&key=chapter1');
  await f.wait(async()=>{const data=await f.send({type:'list'});return data.videos?.some(v=>v.title==='Coral science');});
  const backup=await f.send({type:'export'});
  assert.equal(backup.error,undefined);const serialized=JSON.stringify(backup);
  assert.equal(serialized.includes(secret),false);assert.equal(serialized.includes('abcdefghijklmnopqrstuvwxyz123456'),false);assert.ok(serialized.includes('redacted'));
  const {tabId,results}=await f.worker.evaluate(async()=>{
   const [tab]=await chrome.tabs.query({url:'https://example.com/*'});
   const injected=await chrome.scripting.executeScript({target:{tabId:tab.id},func:async()=>{
    const results=[];
    for(const msg of [{type:'export'},{type:'clear'},{type:'import',data:{format:'recall-export',videos:[]}},{target:'offscreen',type:'export'},{target:'offscreen',type:'clear'}]){
     try{const value=await chrome.runtime.sendMessage(msg);results.push({type:msg.type,target:msg.target,error:value?.error||(!value?'no response':null)});}catch(error){results.push({type:msg.type,target:msg.target,error:error.message});}
    }
    return results;
   }});return {tabId:tab.id,results:injected[0].result};
  });
  assert.ok(results.every(result=>result.error),JSON.stringify(results));
  const after=await f.send({type:'export'});assert.deepEqual({...after,exportedAt:null},{...backup,exportedAt:null},'denied changes preserve saved data');
  const popup=await f.context.newPage();await popup.goto(f.base+'/popup/popup.html');
  const search=await popup.evaluate(()=>chrome.runtime.sendMessage({type:'search',query:'symbiotic algae',distinct:true}));assert.equal(search.error,undefined);assert.ok(search.results.length);
  await f.send({type:'clear'});assert.equal((await f.send({type:'list'})).videos.length,0);
  const restored=await f.send({type:'import',data:{...backup,screenText:[{videoId:backup.items[0].videoId,start:5,text:'Ocean science '+secret,observedLines:['Ocean science '+secret],indexedAt:Date.now()}]}});assert.equal(restored.error,undefined);assert.ok((await f.send({type:'list'})).videos.length);
  const restoredBackup=await f.send({type:'export'});assert.equal(JSON.stringify(restoredBackup).includes(secret),false);assert.ok(restoredBackup.screenText[0].text.includes('redacted'));
  for(const path of ['/private','/payment']){
   await page.goto('https://example.com'+path);
   await f.wait(async()=>{const result=await f.worker.evaluate(async tabId=>(await chrome.tabs.sendMessage(tabId,{type:'web-context'})).private,tabId).catch(()=>false);return result;});
  }
  assert.deepEqual(errors,[]);
  console.log('SECURITY_HARDENING_PASS',JSON.stringify({redactedBeforeStorage:true,ordinaryUrlPreserved:true,deniedCommands:results.length,search:true,backupRoundtrip:true,privateMarkers:true,paymentForms:true}));
 }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
