const fixture=require('./web-fixture.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const report={checks:[],errors:[]},output=process.env.RECALL_REPORT_DIR;
(async()=>{
 const f=await fixture();
 f.context.on('weberror',event=>report.errors.push(event.error().message));
 try{
  await f.context.addInitScript(()=>{
   if(!location.pathname.endsWith('/popup/popup.html'))return;
   window.queries=[];window.opened=[];window.videoStatusCalls=0;window.close=()=>{};
   chrome.tabs.query=async()=>[{id:99,url:'https://www.youtube.com/watch?v=aaaaaaaaaaa',title:'Current video'}];
   chrome.tabs.sendMessage=async()=>({video:{videoId:'aaaaaaaaaaa',title:'Current video'}});
   chrome.tabs.create=async data=>{opened.push(data);return{id:999};};
   const original=chrome.runtime.sendMessage.bind(chrome.runtime);
   chrome.runtime.sendMessage=async message=>{
    if(message.type==='status')return{videos:2,chunks:2,model:{status:'ready'}};
    if(message.type==='warmup')return{};
    if(message.type==='video-status'){videoStatusCalls++;return{has:true,content:true};}
    if(message.type!=='search')return original(message);
    queries.push(message);
    if(message.query==='broken fixture')return{error:'Controlled model error'};
    if(message.query==='nothing saved fixture')return{results:[],empty:true};
    if(message.query==='missing fixture')return{results:[]};
    const related=message.query==='that video of a car';
    const results=[{videoId:'aaaaaaaaaaa',title:message.query,text:'Saved evidence',start:42,match:related?'related':'close'}];
    if(message.query==='two similar cars')results.push({videoId:'bbbbbbbbbbb',title:'Another car',text:'Other saved evidence',start:80,match:'close'});
    return{results,nearTie:message.query==='two similar cars'};
   };
  });
  await f.options.evaluate(()=>chrome.storage.session.set({lastQuery:''}));
  const page=await f.context.newPage();await page.goto(f.base+'/popup/popup.html');
  await page.locator('#video-scope-row').waitFor({state:'visible'});
  const search=async query=>{
   await page.locator('#q').fill(query);await page.locator('#q').press('Enter');
   await page.waitForFunction(query=>queries.at(-1)?.query===query&&(document.querySelector('.result .title')?.textContent===query||['Add one more detail','Search failed','Couldn’t search this video'].includes(document.querySelector('.empty h2')?.textContent)||document.querySelector('.empty h2')?.textContent==='Nothing saved yet'),query);
  };
  for(const query of ['...', 'that', 'or', 'I', 'that or I', '“?!”']){
   const before=await page.evaluate(()=>queries.length);
   await page.locator('#q').fill(query);await page.locator('#q').press('Enter');
   await page.waitForFunction(()=>document.querySelector('.empty h2')?.textContent==='Describe something you remember');
   assert.equal(await page.evaluate(()=>queries.length),before,'filler/punctuation never reaches the search engine');
   assert.equal(await page.locator('.result').count(),0);
   assert.equal(await page.locator('#refine').isVisible(),false);
   assert.equal(await page.locator('#search-retry').isVisible(),false);
  }
  const checksBefore=await page.evaluate(()=>videoStatusCalls);
  await page.locator('#video-scope').check();
  assert.equal(await page.evaluate(()=>videoStatusCalls),checksBefore,'blocked queries do not check or index the current video');
  await page.locator('#kind-filter').selectOption('video');
  assert.equal(await page.evaluate(()=>queries.length),0,'filters do not bypass the guard');
  if(output){await page.setViewportSize({width:440,height:600});await page.screenshot({path:path.join(output,'cuewoven-describe-memory.png'),fullPage:true});}
  await page.locator('#video-scope').uncheck();await page.locator('#kind-filter').selectOption('all');
  for(const query of ['car','Minecraft','photosynthesis','open','AI','猫','42','"I"','“that”']){
   const before=await page.evaluate(()=>queries.length);await search(query);
   assert.equal(await page.evaluate(()=>queries.length),before+1,'meaningful short or explicitly quoted queries still submit');
  }
  report.checks.push('filler/punctuation skip search and scoped indexing; meaningful single words and quoted filler submit');
  const beforeDraft=await page.evaluate(()=>queries.length);
  await page.locator('#q').fill('car');
  assert.equal(await page.evaluate(()=>queries.length),beforeDraft,'short drafts are not blocked or automatically submitted');
  assert.equal(await page.locator('#refine').isVisible(),false);
  await search('red Ferrari');
  assert.equal(await page.locator('#refine-panel').isVisible(),false,'a short strong match needs no forced refinement');
  assert.equal(await page.locator('#refine-toggle').innerText(),'Not it? Add a detail');
  report.checks.push('short strong queries remain searchable without a forced prompt');
  await search('that video of a car');
  assert.equal(await page.locator('#refine-toggle').innerText(),'Add one more detail to narrow it down');
  assert.equal(await page.locator('#refine-toggle').getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#refine-panel').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'q','guidance does not steal focus');
  assert.equal(await page.locator('.result').count(),1,'weak matches stay available');
  assert.equal(await page.locator('#refine-question').innerText(),'What was the car doing?');
  const beforeChip=await page.evaluate(()=>queries.length);
  await page.locator('[data-question="screen"]').click();
  assert.equal(await page.locator('#refine-question').innerText(),'Do you remember the color or surroundings of the car?');
  assert.equal(await page.locator('#details').inputValue(),'','questions never fill in an answer');
  assert.equal(await page.evaluate(()=>queries.length),beforeChip,'choosing a question never submits it');
  assert.equal(await page.locator('#details').getAttribute('aria-describedby'),'refine-question');
  await page.locator('#refine-toggle').click();assert.equal(await page.locator('#refine-panel').isVisible(),false,'guidance can be collapsed');
  await page.locator('#refine-toggle').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'details');
  const previous=await page.evaluate(()=>queries.length);
  await page.locator('#details').fill('flipping over on a wet track');
  assert.equal(await page.evaluate(()=>queries.length),previous,'details wait for Enter');
  await page.locator('#details').press('Enter');
  await page.waitForFunction(()=>document.querySelector('.result .title')?.textContent==='that video of a car. flipping over on a wet track');
  assert.equal(await page.evaluate(()=>queries.at(-1).query),'that video of a car. flipping over on a wet track','only user-supplied text is added');
  assert.equal(await page.locator('#refine-question').innerText(),'What else happened around the car?','follow-up uses the added action');
  report.checks.push('weak result opens optional guidance; keyboard and user-written refinement work');
  await search('two similar cars');
  assert.equal(await page.locator('#refine-panel').isVisible(),true);
  assert.equal(await page.locator('.result').count(),2,'near ties keep both alternatives available');
  report.checks.push('near ties prompt for detail without hiding results');
  await search('the speaker calling himself old and having back pain');
  await page.locator('#refine-toggle').click();
  assert.match(await page.locator('#refine-question').innerText(),/exact words.*old.*back pain/);
  assert.ok(!(await page.locator('#refine-question').innerText()).includes('car'),'questions change with the new query');
  await page.locator('[data-question="when"]').click();
  assert.match(await page.locator('#refine-question').innerText(),/When did you see.*back pain/);
  await search('the article about coral bleaching');await page.locator('#refine-toggle').click();
  assert.match(await page.locator('#refine-question').innerText(),/point or example.*coral bleaching/);
  await search('that video of a car');
  if(output){await page.setViewportSize({width:440,height:600});await page.screenshot({path:path.join(output,'cuewoven-car-questions.png'),fullPage:true});}
  report.checks.push('query-aware vehicle, speaker and article questions update without adding answers');
  await search('missing fixture');
  assert.equal(await page.locator('.empty h2').innerText(),'Add one more detail');
  assert.match(await page.locator('#refine-question').innerText(),/“missing fixture”/);
  assert.equal(await page.locator('#refine-panel').isVisible(),true);
  assert.equal(await page.locator('#search-retry').isVisible(),false);
  // The browser action popup has an existing fixed width of 440 px.
  for(const width of [440,768,1024]){
   await page.setViewportSize({width,height:600});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no overflow at '+width);
  }
  if(output){await page.setViewportSize({width:440,height:600});await page.screenshot({path:path.join(output,'cuewoven-add-detail.png'),fullPage:true});}
  await page.locator('.chip[data-days="7"]').click();
  await page.waitForFunction(()=>document.querySelector('.empty .hint')?.textContent.includes('Any time'));
  assert.equal(await page.locator('.empty h2').innerText(),'Add one more detail');
  await page.locator('#video-scope').check();
  await page.waitForFunction(()=>queries.at(-1)?.videoId==='aaaaaaaaaaa');
  assert.match(await page.locator('#refine-question').innerText(),/“missing fixture”/);
  report.checks.push('no matches use constructive copy, scoped wording, date advice and responsive refinement');
  await search('nothing saved fixture');
  assert.equal(await page.locator('.empty h2').innerText(),'Add one more detail','empty scoped library retains guidance');
  await search('broken fixture');
  assert.equal(await page.locator('.empty h2').innerText(),'Couldn’t search this video');
  assert.match(await page.locator('.empty').innerText(),/Controlled model error/);
  assert.equal(await page.locator('#search-retry').isVisible(),true);
  assert.equal(await page.locator('#refine').isVisible(),false);
  await page.locator('#video-scope').uncheck();
  await page.waitForFunction(()=>document.querySelector('.empty h2')?.textContent==='Search failed');
  report.checks.push('real error state retains cause and retry instead of asking for more detail');
  await search('red Ferrari');await page.locator('.result').click();
  assert.equal(await page.evaluate(()=>opened[0]?.url),'https://www.youtube.com/watch?v=aaaaaaaaaaa&t=42s');
  await page.locator('#q').fill('');
  assert.equal(await page.locator('#refine').isVisible(),false);
  assert.deepEqual(report.errors,[]);report.pass=true;
  console.log('DETAIL_GUIDANCE_PASS',JSON.stringify(report));
 }finally{if(output)fs.writeFileSync(path.join(output,'detail-guidance.json'),JSON.stringify(report,null,2));await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
