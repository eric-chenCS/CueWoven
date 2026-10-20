const fixture=require('./web-fixture.cjs'),assert=require('assert/strict'),path=require('path'),os=require('os');
(async()=>{const f=await fixture();try{
 const manifest=await f.options.evaluate(()=>chrome.runtime.getManifest());
 assert.match(manifest.name,/^CueWoven /);assert.match(manifest.short_name,/^CueWoven /);assert.equal(manifest.action.default_title,'CueWoven');
 assert.equal(manifest.commands._execute_action.suggested_key.default,'Ctrl+Shift+F');assert.equal(manifest.omnibox,undefined,'no address-bar keyword');
 assert.equal(await f.options.locator('.brand h1').innerText(),'CueWoven');assert.match(await f.options.title(),/^CueWoven /);
 const oldTitle='Recall techniques in psychology',videoId='rename00001';
 await f.send({type:'status'}); // starts the offscreen engine before talking to it directly
 const added=await f.send({target:'offscreen',type:'import-history',videos:[{videoId,title:oldTitle,channel:'Fixture',watchedAt:Date.now()}]});assert.ok(!added.error,added.error);
 await f.options.evaluate(()=>chrome.storage.local.set({theme:'dark',onboardingComplete:true,settings:{enabled:false,maxAgeDays:0,importMaxAgeDays:0}}));
 await f.options.reload();await f.options.waitForFunction(()=>document.querySelector('#theme').value==='dark');
 const databases=await f.options.evaluate(()=>indexedDB.databases());assert.ok(databases.some(db=>db.name==='recall'));assert.ok(!databases.some(db=>db.name==='cuewoven'));
 const backup=await f.send({type:'export'});assert.equal(backup.format,'recall-export');assert.equal(backup.videos[0].title,oldTitle);
 await f.send({type:'clear'});const restored=await f.send({type:'import',data:backup});assert.ok(!restored.error,restored.error);
 const listed=await f.send({type:'list'});assert.equal(listed.videos.find(v=>v.videoId===videoId).title,oldTitle);
 const download=f.options.waitForEvent('download');await f.options.locator('#export').click();assert.match((await download).suggestedFilename(),/^cuewoven-index-.*\.json$/);
 const popup=await f.context.newPage();await popup.goto(f.base+'/popup/popup.html');assert.equal(await popup.locator('.brand span').innerText(),'CueWoven');assert.equal(await popup.locator('#q').getAttribute('aria-label'),'Search your CueWoven library');
 await popup.locator('#q').fill('Recall techniques in psychology');await popup.locator('#q').press('Enter');await popup.waitForFunction(()=>document.querySelector('.result .title')?.textContent==='Recall techniques in psychology');
 await popup.locator('body').screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR||os.tmpdir(),'cuewoven-popup.png')});
 console.log('CUEWOVEN_BRANDING_PASS: visible name, original database, legacy backup roundtrip, unchanged saved titles/settings, renamed download, icon action and shortcut retained');
}finally{await f.close()}})().catch(error=>{console.error(error);process.exitCode=1});
