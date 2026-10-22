// Real local MiniLM/Ettin inference in an isolated Edge profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const fixture=require('./web-fixture.cjs'),source=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..');
const report={checks:[],queries:[],errors:[],downloads:[]};
const id=value=>value.startsWith('h-')?'h'+crypto.createHash('sha256').update(value).digest('hex').slice(0,10):value.padEnd(11,'_').slice(0,11);
const query='a video of the speaker calling himselve old and having back pain';
(async()=>{
 const f=await fixture({prepareExtension(extension){
  if(process.env.RECALL_LITE_MUTATION==='allow-rerank'){
   const file=path.join(extension,'offscreen/offscreen.js'),text=fs.readFileSync(file,'utf8');
   assert.ok(text.includes('if(lightMode||busy||'));
   fs.writeFileSync(file,text.replace('if(lightMode||busy||','if(busy||'));
  }
 }});
 f.context.on('weberror',e=>report.errors.push(e.error().message));
 const offscreenPage=async()=>{const targets=await f.worker.evaluate(()=>chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']}));return targets[0].documentUrl;};
 try{
  report.browser=await f.context.browser().version();
  const assets=await import(pathToFileURL(path.join(source,'offscreen/rerank-assets.js')).href),prefix=`https://huggingface.co/${assets.RERANK_MODEL}/resolve/${assets.RERANK_REVISION}/`;
  if(process.env.RECALL_ETTIN_MODELS)await f.context.route(prefix+'**',async route=>{
   const file=route.request().url().slice(prefix.length);assert.ok(Object.hasOwn(assets.RERANK_ASSETS,file));report.downloads.push(file);
   await route.fulfill({path:path.join(process.env.RECALL_ETTIN_MODELS,file),contentType:'application/octet-stream'});
  });
  await f.enable();
  assert.equal((await f.send({type:'status'})).error,undefined);
  const setLite=async value=>{
   await f.options.evaluate(async value=>{const {settings}=await chrome.storage.local.get('settings');await chrome.storage.local.set({settings:{...settings,lightMode:value}});},value);
  };
  const search=async(q=query,extra={})=>{
   const start=performance.now(),r=await f.send({target:'offscreen',type:'search',query:q,perVideo:1,limit:40,...extra});assert.equal(r.error,undefined);
   report.queries.push({query:q,lite:(await f.options.evaluate(()=>chrome.storage.local.get('settings'))).settings.lightMode,ms:performance.now()-start,reranked:!!r.reranked,pending:!!r.rerankPending,top:r.results[0]?.videoId});return r;
  };
  const status=async()=>(await f.send({type:'status'})).reranker.status;
  await setLite(true);
  const stress=await import(pathToFileURL(path.join(source,'tests/fixtures/search-stress.mjs')).href);
  for(const v of stress.videos){const r=await f.send({target:'offscreen',type:'index',method:'controlled-test',video:{videoId:id(v.videoId),title:v.title,channel:v.channel,watchedAt:Date.now()},segments:v.chunks.map(c=>({...c,dur:8}))});assert.equal(r.error,undefined);}
  const before=await f.send({type:'export'});assert.equal(before.error,undefined);
  const lite=await search();assert.equal(lite.rerankPending,undefined);assert.equal(lite.reranked,undefined);assert.equal(lite.results[0].videoId,'iGDOWFcMRDs');
  assert.equal(await status(),'idle');assert.equal(report.downloads.length,0);
  report.checks.push('Fresh Lite search uses real text embeddings without starting or downloading Ettin');
  await setLite(false);
  const loading=await search();assert.equal(loading.rerankPending,true);assert.equal(await status(),'loading');
  await setLite(true);await f.wait(async()=>await status()==='idle');
  const duringLoad=await search();assert.equal(duringLoad.rerankPending,undefined);assert.deepEqual(duringLoad.results,lite.results);
  report.checks.push('Enabling Lite cancels model loading and cached pending search falls back to baseline');
  await setLite(false);await search();await f.wait(async()=>await status()==='ready');
  const scoring=search();await f.wait(async()=>await status()==='working');
  const normal=await scoring;assert.equal(normal.rerankPending,undefined);assert.equal(await status(),'ready');
  report.checks.push('Disabling Lite restores real selective reranking');
  const popup=await f.context.newPage();await popup.goto(f.base+'/popup/popup.html');await popup.locator('#q').fill(query);await popup.locator('#q').press('Enter');
  await popup.waitForFunction(()=>document.querySelector('.result'));
  await setLite(true);await f.wait(async()=>await status()==='idle');
  await popup.waitForFunction(()=>document.body.textContent.includes('Press Enter to search')&&!document.querySelector('.result'));
  await popup.close();report.checks.push('Open popup clears old-mode results and paging when Lite changes');
  const restored=await search();assert.equal(restored.reranked,undefined);assert.deepEqual(restored.results,lite.results,'Discard cached normal-mode ranking');
  const page=await search(query,{offset:1,limit:2});assert.deepEqual(page.results,restored.results.slice(1,3));
  report.checks.push('Enabling Lite releases ready worker, clears reranked cache, preserves baseline paging');
  await setLite(false);await search();await f.wait(async()=>await status()==='ready');
  const pending=search('twisting the little knob wont replace a dead battery .');
  await f.wait(async()=>await status()==='working');
  await setLite(true);const cancelled=await pending;assert.equal(cancelled.reranked,undefined);assert.equal(await status(),'idle');
  report.checks.push('Enabling Lite during inference cancels it without publishing advanced ranking');
  const difficult=stress.queries.filter(q=>q.expected.length).slice(-24);
  for(const q of difficult){const r=await search(q.query);assert.equal(r.reranked,undefined);assert.equal(r.rerankPending,undefined);assert.ok(r.results.every(h=>!h.scene));}
  assert.equal(await status(),'idle');
  const {exportedAt:beforeTime,...beforeContent}=before;
  const {exportedAt:afterTime,...afterContent}=await f.send({type:'export'});
  assert.deepEqual(afterContent,beforeContent,'Mode changes and searches preserve stored evidence/timestamps');
  report.checks.push('24 additional difficult Lite queries keep reranker idle and preserve exported library');
  await f.options.reload();await f.options.waitForFunction(()=>document.querySelector('#lightMode').checked);
  const hint=await f.options.locator('label').filter({has:f.options.locator('#lightMode')}).innerText();assert.match(hint,/difficult searches may be less accurate/);
  for(const width of [320,768,1024]){await f.options.setViewportSize({width,height:900});assert.ok(await f.options.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  if(process.env.RECALL_REPORT_DIR)await f.options.locator('#lightMode').locator('..').screenshot({path:path.join(process.env.RECALL_REPORT_DIR,'lite-reranker-setting.png')});
  assert.deepEqual(report.errors,[]);report.pass=true;
 }finally{
  // Fixture copies are owned scratch directories; never remove a normal browser profile.
  const url=await offscreenPage().catch(()=>null);await f.close();
  report.offscreenUrl=url;
  if(process.env.RECALL_REPORT_DIR)fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR,'lite-reranker.json'),JSON.stringify(report,null,2));
 }
 console.log('LITE_RERANKER_PASS',JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
