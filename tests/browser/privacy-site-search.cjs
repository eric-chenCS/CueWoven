const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const f=await fixture({sites:['example.com','school.edu']}),report={checks:[],errors:[]};
 f.context.on('weberror',event=>report.errors.push(event.error().message));
 const checked=async message=>{const result=await f.send(message);assert.equal(result.error,undefined,JSON.stringify(result));return result;};
 try{
  await f.enable();
  await f.options.evaluate(()=>chrome.storage.local.set({onboardingComplete:true,settings:{enabled:true,lightMode:true,dwellSeconds:0,maxAgeDays:0}}));
  await f.context.route(/https:\/\/(?:example\.com|school\.edu)\//,route=>{
   const pathname=new URL(route.request().url()).pathname,verification=pathname.includes('verification-form');
   return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Coral research</title><article><h1>Coral reef biology</h1><p>Coral bleaching occurs when warm ocean water drives symbiotic algae away. Marine biologists study ocean temperature and coral recovery in tropical reefs.</p></article>'+(verification?'<input '+(pathname.startsWith('/hidden')?'style="display:none" ':'')+'autocomplete="'+(pathname.startsWith('/section')?'section-signin ':'')+'one-time-code">':'')});
  });
  await checked({target:'offscreen',type:'index',method:'controlled-test',video:{videoId:'site0000001',title:'Coral reef biology',watchedAt:Date.now()},segments:[{start:12,text:'Coral bleaching occurs when warm ocean water drives symbiotic algae away.'}]});
  const article=await f.context.newPage();await article.goto('https://example.com/research');
  await f.wait(async()=>(await checked({type:'list'})).videos.some(v=>v.url==='https://example.com/research'));
  const specific=await checked({type:'search',query:'a YouTube video about coral bleaching'});
  assert.ok(specific.results.length);assert.ok(specific.results.every(row=>row.videoId==='site0000001'));assert.equal(specific.appliedSource,'youtube.com');
  report.checks.push('real MiniLM search returns only the requested website');
  for(const query of ['an article from example.com about coral bleaching','coral bleaching from example.com.','coral bleaching from https://www.example.com/research']){
   const website=await checked({type:'search',query});assert.equal(website.appliedSource,'example.com');
   assert.ok(website.results.length);assert.ok(website.results.every(row=>row.url?.startsWith('https://example.com/')));
  }
  const absent=await checked({type:'search',query:'an article from absent.example.org about coral bleaching'});
  assert.equal(absent.results.length,0);assert.equal(absent.appliedSource,'absent.example.org');assert.equal(absent.filtersRelaxed,false);
  const broad=await checked({type:'search',query:'an article from absent.example.org about coral bleaching',inferFilters:false});
  assert.ok(broad.results.length);assert.equal(broad.appliedSource,'');
  report.checks.push('empty website search stays scoped; explicit broadening finds saved evidence');
  const popup=await f.context.newPage();await popup.goto(f.base+'/popup/popup.html');
  await popup.locator('#q').fill('an article from absent.example.org about coral bleaching');await popup.locator('#q').press('Enter');
  await popup.waitForFunction(()=>document.querySelector('.empty h2')?.textContent==='No matches on absent.example.org');
  assert.equal(await popup.locator('.result').count(),0);assert.match(await popup.locator('#applied-filters').innerText(),/absent\.example\.org/);
  if(process.env.RECALL_REPORT_DIR)await popup.screenshot({path:path.join(process.env.RECALL_REPORT_DIR,'no-site-matches.png')});
  await popup.locator('#ignore-inferred').click();await popup.locator('.result').first().waitFor();
  assert.equal(await popup.locator('#applied-filters').isVisible(),false);
  for(const status of ['loading','error']){
   await f.options.evaluate(status=>chrome.runtime.sendMessage({type:'model-status',state:{status,progress:.45,error:'Controlled test'}}).catch(()=>{}),status);
   await popup.waitForFunction(status=>document.querySelector('#model-text').textContent.includes(status==='loading'?'Loading search engine… 45%':'Couldn’t load the search engine'),status);
  }
  await f.options.evaluate(()=>chrome.runtime.sendMessage({type:'vision-state',state:{status:'loading',progress:.45}}).catch(()=>{}));
  await popup.waitForFunction(()=>document.querySelector('#scene-status').textContent==='Loading visual search… 45%');
  report.checks.push('popup explains no site matches, broadens on click, and displays search-engine wording');
  await popup.close();
  const tabId=await f.worker.evaluate(async()=> (await chrome.tabs.query({url:'https://example.com/research'}))[0].id);
  for(const url of ['https://example.com/verification-form','https://example.com/section-verification-form','https://school.edu/sso/continue','https://school.edu/student/grades']){
   await article.goto(url);
   await f.wait(async()=>f.worker.evaluate(async id=>(await chrome.tabs.sendMessage(id,{type:'web-context'})).private,tabId).catch(()=>false));
   const attempt=await f.worker.evaluate(async id=>chrome.tabs.sendMessage(id,{type:'index-now'}),tabId);
   assert.equal(attempt.ok,false,url);
   assert.ok(!(await checked({type:'list'})).videos.some(v=>v.url===url),url);
  }
  await article.goto('https://example.com/hidden-verification-form');
  await f.wait(async()=>(await checked({type:'list'})).videos.some(v=>v.url==='https://example.com/hidden-verification-form'));
  await article.goto('https://school.edu/research/coral');
  await f.wait(async()=>(await checked({type:'list'})).videos.some(v=>v.url==='https://school.edu/research/coral'));
  report.checks.push('visible OTP fields and private university routes refuse capture; public university research saves');
  assert.deepEqual(report.errors,[]);report.pass=true;report.browser=await f.context.browser()?.version();
  if(process.env.RECALL_REPORT_DIR){fs.mkdirSync(process.env.RECALL_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR,'browser.json'),JSON.stringify(report,null,2));}
  console.log('PRIVACY_SITE_SEARCH_PASS',JSON.stringify(report));
 }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
