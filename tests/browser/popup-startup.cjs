const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const f=await fixture({prepareExtension(extension){
  const file=path.join(extension,'options/web-options.js'),source=fs.readFileSync(file,'utf8'),needle='const initial = initialSiteSettings(webCapture);';assert.ok(source.includes(needle));
  fs.writeFileSync(file,source.replace(needle,'await new Promise(resolve=>setTimeout(resolve,250));'+needle));
 }}),report={checks:[],errors:[]};f.context.on('weberror',event=>report.errors.push(event.error().message));
 try{
  assert.equal(f.context.pages().filter(page=>page.url().startsWith(f.base+'/options/options.html')).length,1,'fixture reuses the install page');
  assert.equal(await f.options.evaluate(async()=>(await chrome.storage.local.get('webCapture')).webCapture?.siteDefaultsVersion),2,'test customization starts after first-run setup');
  await f.options.evaluate(()=>chrome.storage.local.set({onboardingComplete:true,settings:{enabled:true,lightMode:true,maxAgeDays:0}}));
  await f.send({type:'status'});assert.ok(!(await f.send({target:'offscreen',type:'load-samples'})).error);
  for(const action of ['restore','restore-custom','typing','submitted','filter']){
   await f.options.evaluate(action=>chrome.storage.session.set({lastQuery:'battery charging capacity',sinceDays:7,customRange:action==='restore'?null:{from:'2020-01-01',to:'2020-01-02'},inferFilters:false}),action);
   const popup=await f.context.newPage();
   await popup.addInitScript(()=>{
    const original=chrome.runtime.sendMessage.bind(chrome.runtime);let first=true;
    chrome.runtime.sendMessage=(message,...args)=>{
     const result=original(message,...args);
     if(message.type==='status'&&first){first=false;return result.then(value=>new Promise(resolve=>window.releaseBoot=()=>resolve(value)));}
     if(message.type==='warmup')window.bootFinished=true;
     return result;
    };
   });
   await popup.goto(f.base+'/popup/popup.html');await popup.waitForFunction(()=>typeof window.releaseBoot==='function');
   const query='warm ocean water makes coral lose its algae';
   if(action==='typing'||action==='submitted')await popup.locator('#q').fill(query);
   if(action==='submitted'){
    await popup.locator('#q').press('Enter');await popup.waitForFunction(()=>document.querySelector('.best .result')?.href.includes('rcDemo00002'));
   }
   if(action==='filter')await popup.locator('.chip[data-days="1"]').click();
   await popup.evaluate(()=>window.releaseBoot());await popup.waitForFunction(()=>window.bootFinished);
   if(action==='restore'||action==='restore-custom'){
    assert.equal(await popup.locator('#q').inputValue(),'battery charging capacity');assert.equal(await popup.locator(`.chip[data-days="${action==='restore'?7:'custom'}"]`).getAttribute('aria-checked'),'true');
    if(action==='restore-custom'){assert.equal(await popup.locator('#range-from').inputValue(),'2020-01-01');assert.equal(await popup.locator('#range-to').inputValue(),'2020-01-02');}
   }else{
    assert.equal(await popup.locator('#q').inputValue(),action==='filter'?'':query,'late session restoration must preserve current input');
    assert.equal(await popup.locator(`.chip[data-days="${action==='filter'?1:0}"]`).getAttribute('aria-checked'),'true','late restoration must preserve current filters');
    if(action==='submitted')assert.ok((await popup.locator('.best .result').getAttribute('href')).includes('rcDemo00002'),'late boot must not discard displayed results');
   }
   report.checks.push(action);await popup.close();
  }
  assert.deepEqual(report.errors,[]);report.pass=true;console.log('POPUP_STARTUP_PASS',JSON.stringify(report));
 }finally{if(process.env.RECALL_REPORT_DIR)fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR,'popup-startup.json'),JSON.stringify(report,null,2));await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
