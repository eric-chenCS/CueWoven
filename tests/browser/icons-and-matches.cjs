const fixture=require('./web-fixture.cjs'),assert=require('assert/strict'),path=require('path'),os=require('os');
(async()=>{const f=await fixture(),errors=[];f.context.on('weberror',e=>errors.push(e.error().message));try{
 await f.options.waitForFunction(()=>document.querySelector('#web-site-count').textContent==='1');
 assert.equal(await f.options.evaluate(()=>chrome.permissions.contains({permissions:['favicon']})),true);
 assert.equal(await f.options.locator('#web-sites [aria-label="Remove youtube.com"]').count(),1);
 assert.equal(await f.options.locator('#web-sites [aria-label="Remove instagram.com"]').count(),0);
 await f.options.evaluate(()=>{window.realPermission=chrome.permissions.request.bind(chrome.permissions);chrome.permissions.request=async()=>true;});
 await f.options.locator('#web-restore').click();await f.options.waitForFunction(()=>document.querySelector('#web-site-count').textContent==='31');
 await f.options.evaluate(()=>chrome.permissions.request=window.realPermission);
 const initial=await f.options.evaluate(()=>chrome.storage.local.get('webCapture'));assert.equal(initial.webCapture.enabled,true);assert.equal(initial.webCapture.siteDefaultsInitialized,true);
 await f.options.waitForFunction(()=>{const image=document.querySelector('#web-sites img');return image.complete&&image.naturalWidth>0;});
 await f.options.locator('#web-site-list > summary').click();assert.equal(await f.options.locator('#web-sites').isVisible(),false);
 await f.options.locator('#web-site-list > summary').click();
 await f.options.locator('#web-sites [aria-label="Remove instagram.com"]').click();
 await f.options.waitForFunction(()=>document.querySelector('#web-msg').textContent.startsWith('Removed instagram.com'));
 await f.options.reload();await f.options.waitForFunction(()=>document.querySelector('#web-site-count').textContent==='30');
 assert.equal(await f.options.locator('#web-sites [aria-label="Remove instagram.com"]').count(),0,'reload cannot restore an excluded starter site');
 assert.equal((await f.send({type:'web-import',items:[{kind:'page',url:'https://instagram.com/p/public',title:'Excluded post',watchedAt:Date.now()}]})).imported,0);
 const added=await f.send({type:'web-import',items:[{kind:'page',url:'https://articles.example.com/one',title:'Coral reef science article one',watchedAt:Date.now()},{kind:'page',url:'https://articles.example.com/two',title:'Coral reef science article two',watchedAt:Date.now()}]});assert.equal(added.imported,2);
 const video=await f.send({type:'import-history',videos:[{videoId:'iconTest001',title:'Coral reef science video',channel:'Fixture',watchedAt:Date.now()}]});assert.equal(video.error,undefined);
 await f.options.reload();await f.options.waitForFunction(()=>document.querySelectorAll('#library .vid').length===3);
 await f.options.waitForFunction(()=>[...document.querySelectorAll('#library img.website-icon')].length===2&&[...document.querySelectorAll('#library img.website-icon')].every(img=>img.complete&&img.naturalWidth>0));
 // An unavailable browser icon gets a real local image instead of a broken-image box.
 await f.options.locator('#library img.website-icon').first().evaluate(async img=>{const {setItemImage}=await import('../lib/item-image.js');setItemImage(img,{kind:'page',url:'https://articles.example.com'});img.onerror();});
 await f.options.waitForFunction(()=>[...document.querySelectorAll('#library img')].some(img=>img.src.endsWith('/icons/site.svg')&&img.complete&&img.naturalWidth>0));
 const popup=await f.context.newPage();await popup.goto(f.base+'/popup/popup.html');await popup.locator('#q').fill('coral reef science');
 await popup.waitForFunction(()=>document.querySelector('#page-label').textContent==='Best match'&&!!document.querySelector('.result'));
 for(const label of ['Match 2','Match 3']){await popup.locator('#next-video').click();await popup.waitForFunction(label=>document.querySelector('#page-label').textContent===label,label);}
 assert.equal(await popup.locator('#next-video').isDisabled(),true);assert.equal(await popup.locator('body').evaluate(node=>node.scrollWidth),440);
 await popup.screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR||os.tmpdir(),'recall-v3.3.7-match.png')});
 assert.equal(await f.options.locator('#web-forget-domain').count(),0);
 assert.deepEqual(errors,[]);console.log('ICONS_MATCHES_PASS: browser icons load, local fallback loads, starter sites initialize once, exclusions survive reload/import, mixed page/video Match 2/3 navigation.');
}finally{await f.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
