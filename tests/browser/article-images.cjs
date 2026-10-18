// Real article capture, q8 CLIP recognition, CORS boundaries, backup and storage lifecycle.
// Set RECALL_MODEL_DIR, RECALL_TEST_PHOTO, RECALL_BROWSER and RECALL_PLAYWRIGHT.
const fixture=require('./web-fixture.cjs'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
if(!process.env.RECALL_MODEL_DIR||!process.env.RECALL_TEST_PHOTO)throw Error('Set local model directory and a local public cat-photo fixture.');
(async()=>{
 const f=await fixture(),{context,options,send,wait,enable}=f,errors=[];
 context.on('weberror',error=>errors.push(String(error.error())));
 const raw=async(type,data={})=>send({target:'offscreen',type,...data});
 const rows=()=>send({type:'list'}).then(r=>r.videos);
 const scenes=()=>options.evaluate(async()=>{const db=await import('../lib/db.js');return db.scenes.vectors()});
 try{
  await options.evaluate(()=>chrome.storage.local.set({onboardingComplete:true,singleVideoView:true}));
  const diagrams=await options.evaluate(()=>['red','blue','green'].map((color,i)=>{const c=document.createElement('canvas');c.width=360;c.height=240;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,360,240);x.fillStyle=color;x.fillRect(40+i*20,40,170,150);return c.toDataURL('image/png').split(',')[1]}));
  const cat=fs.readFileSync(process.env.RECALL_TEST_PHOTO);
  await context.route(/^https:\/\/(?:[^/]+\.example\.com|assets\.example\.net)\//,route=>{
   const u=new URL(route.request().url());
   if(u.pathname.endsWith('.png'))return route.fulfill({contentType:'image/png',headers:u.pathname.includes('blocked')?{'access-control-allow-origin':'https://denied.invalid'}:{'access-control-allow-origin':'*'},body:u.pathname.includes('diagram')?Buffer.from(diagrams[Number(u.searchParams.get('n'))||0],'base64'):cat});
   const name=u.pathname.slice(1),cross=name==='cross',blocked=name==='blocked',secret=name==='private';
   const photos=cross||blocked?`<figure><img src="https://assets.example.net/${blocked?'blocked':'photo'}.png" width="360" height="240" alt="Quasar marmalade" /></figure>`:Array.from({length:4},(_,i)=>`<figure><img src="/${i?'diagram':'photo'}.png?n=${i?i-1:0}" width="240" height="160" alt="${i?'Diagram '+i:'Quasar marmalade'}" /></figure>`).join('');
   return route.fulfill({contentType:'text/html',body:`<!doctype html><title>Field journal ${name}</title><style>body{margin:20px}figure{margin:5px}img{object-fit:contain}</style><main><h1>Field journal ${name}</h1><p>${'Public notes about observations recorded during the week. '.repeat(12)}</p>${secret?'<input type="password">':''}${photos}<img class="logo" src="/photo.png?logo" width="200" height="150"><img style="display:none" src="/photo.png?hidden" width="200" height="150"><aside><img src="/photo.png?aside" width="200" height="150"></aside></main>`});
  });
  await enable({images:true});
  const page=await context.newPage();await page.setViewportSize({width:1000,height:1400});
  const started=Date.now();await page.goto('https://articles.example.com/alpha');
  await wait(async()=>{const v=(await rows()).find(v=>v.url==='https://articles.example.com/alpha');return v?.sceneCount===3;});
  console.log('ARTICLE_CAPTURE_PASS',Date.now()-started,'ms including initial page dwell and model loading');
  let saved=await scenes();assert.equal(saved.length,3);assert.ok(saved.every(s=>s.articleImage&&s.caption));
  const alpha=(await rows()).find(v=>v.url.endsWith('/alpha'));assert.equal(alpha.kind,'page');
  const stored=await options.evaluate(async id=>{const db=await import('../lib/db.js');return db.items.get(id)},alpha.videoId);
  assert.ok(stored.passages.some(p=>p.source==='Page text'));assert.ok(stored.passages.some(p=>p.source==='Image caption'));
  const timings=[];
  for(const query of ['a photograph of two cats sitting on a sofa','a pair of cats on a couch','two cats resting together on furniture']){
   const result=await options.evaluate(async query=>{const t=performance.now(),r=await chrome.runtime.sendMessage({type:'search',query,singleVideo:true});return{...r,ms:performance.now()-t}},query);
   assert.ok(!result.error,result.error);assert.equal(result.results[0].videoId,alpha.videoId);assert.equal(result.results[0].articleImage,true);assert.match(result.results[0].image,/^data:image\/jpeg/);assert.ok(result.results[0].matchSources.includes('Article image'));timings.push(result.ms);
  }
  console.log('REAL_CLIP_VISUAL_SEARCH_PASS',JSON.stringify({coldTextThenWarmMs:timings}));
  const caption=await send({type:'search',query:'quasar marmalade',singleVideo:true});assert.equal(caption.results[0].videoId,alpha.videoId);
  const popup=await context.newPage();await popup.goto(f.base+'/popup/popup.html');
  await popup.locator('#q').fill('two cats resting together on furniture');
  await popup.waitForFunction(()=>[...document.querySelectorAll('.match-sources span')].some(s=>s.textContent==='Article image'));
  assert.equal(await popup.locator('.result').first().getAttribute('href'),alpha.url);
  assert.equal(await popup.locator('.result img').first().getAttribute('alt'),'Quasar marmalade');
  if(process.env.RECALL_SCREENSHOT_DIR)await popup.screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR,'article-image-search.png')});
  await popup.close();console.log('ARTICLE_IMAGE_POPUP_PASS');
  await page.bringToFront();await page.goto('https://articles.example.com/cross');
  await wait(async()=> (await rows()).find(v=>v.url.endsWith('/cross'))?.sceneCount===1);
  await page.goto('https://articles.example.com/blocked');
  await wait(async()=> (await rows()).find(v=>v.url.endsWith('/blocked'))?.chunkCount>0);
  await page.waitForTimeout(6500);assert.equal((await rows()).find(v=>v.url.endsWith('/blocked')).sceneCount||0,0);
  await page.goto('https://articles.example.com/private');await page.waitForTimeout(6500);assert.ok(!(await rows()).some(v=>v.url.endsWith('/private')));
  console.log('CORS_AND_PRIVATE_PAGE_PASS');
  await enable({images:false});await page.reload();await page.goto('https://articles.example.com/off');
  await wait(async()=> (await rows()).find(v=>v.url.endsWith('/off'))?.chunkCount>0);await page.waitForTimeout(2000);
  assert.equal((await rows()).find(v=>v.url.endsWith('/off')).sceneCount||0,0);
  console.log('IMAGE_SETTING_OFF_PASS');
  await page.close();
  const backup=await send({type:'export'});assert.ok(backup.scenes.every(s=>s.articleImage&&s.imageId));
  assert.equal((await send({type:'clear'})).ok,true);assert.equal((await scenes()).length,0);
  const restored=await send({type:'import',data:backup});assert.ok(!restored.error,restored.error);assert.equal((await scenes()).length,4);
  const restoredAlpha=(await rows()).find(v=>v.videoId===alpha.videoId);assert.equal(restoredAlpha.kind,'page');assert.equal(restoredAlpha.sceneCount,3);
  const img=backup.scenes.find(s=>s.videoId===alpha.videoId);
  const changedImage=await options.evaluate(async image=>{const bitmap=await createImageBitmap(await (await fetch(image)).blob()),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();return canvas.toDataURL('image/jpeg',.45)},img.image);
  const pending=raw('article-image',{url:alpha.url,image:changedImage,caption:'a revised caption'}),deleted=send({type:'delete',videoId:alpha.videoId});await Promise.all([pending,deleted]);
  assert.ok(!(await scenes()).some(s=>s.videoId===alpha.videoId));assert.ok(!(await rows()).some(v=>v.videoId===alpha.videoId));
  console.log('BACKUP_DELETE_RACE_PASS');
  const quota=await options.evaluate(async()=>{
   const db=await import('../lib/db.js'),{SCENE_BYTES_TOTAL}=await import('../lib/scenes.js'),video=(await db.listVideos()).find(v=>v.kind==='page');
   const chunk=new Blob([new Uint8Array(1024*1024)]);
   await db.scenes.put({key:video.videoId+':quota',videoId:video.videoId,start:0,image:new Blob(Array(SCENE_BYTES_TOTAL/(1024*1024)+1).fill(chunk),{type:'image/jpeg'}),vec:new Float32Array(512),articleImage:true,indexedAt:Date.now()});
   return{rows:await db.scenes.vectors(),record:await db.getVideo(video.videoId)};
  });assert.equal(quota.rows.length,0);assert.equal(quota.record.sceneCount,0);
  console.log('VISUAL_STORAGE_BUDGET_PASS');
  assert.deepEqual(errors,[]);console.log('ARTICLE_IMAGES_BROWSER_PASS');
 }finally{await f.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
