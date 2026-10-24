// Websites settings: one on/off switch, a visible list of sites, add/remove, plain wording.
const fixture=require('./web-fixture.cjs'),assert=require('assert/strict'),path=require('path');
const SUGGESTED=31;
(async()=>{
 const f=await fixture(),errors=[],output=process.env.RECALL_SCREENSHOT_DIR||require('os').tmpdir(),o=f.options;
 f.context.on('weberror',event=>errors.push(event.error().message));
 const state=()=>o.locator('#web-state').innerText(),msg=text=>o.waitForFunction(t=>document.querySelector('#web-msg').textContent.includes(t),text);
 const stored=()=>o.evaluate(async()=>(await chrome.storage.local.get('webCapture')).webCapture);
 try{
  await o.setViewportSize({width:1280,height:900});await o.emulateMedia({reducedMotion:'reduce'});
  // Fresh install: only YouTube is listed and saving defaults to on.
  await o.evaluate(()=>chrome.storage.local.remove('webCapture'));await o.reload();
  await o.waitForFunction(()=>document.querySelectorAll('#web-sites .site').length>0);
  assert.equal(await o.locator('#web-enabled').isChecked(),true);
  assert.match(await state(),/^On for 1 site\./);
  assert.equal(await o.locator('#web-sites .site').count(),1);
  assert.deepEqual(await o.locator('#web-sites .site-group h3').allInnerTexts(),['Social']);
  assert.equal(await o.locator('#web-restore').isVisible(),true);
  assert.equal(await o.locator('#web-restore').innerText(),'Add suggested sites (30)');
  assert.equal(await o.locator('#web-access-row').isVisible(),false,'YouTube uses existing built-in access');
  for(const old of ['#web-pause','#web-off']) assert.equal(await o.locator(old).count(),0,`${old} is gone`);
  await o.locator('.nav a[href="#sec-websites"]').click();await o.waitForTimeout(300);
  await o.screenshot({path:path.join(output,'websites-default.png')});

  // A legacy partial config does not gain a new capture scope.
  await o.evaluate(()=>chrome.storage.local.set({webCapture:{enabled:false}}));
  await o.waitForFunction(()=>document.querySelectorAll('#web-sites .site').length===0);
  // Work with sites the test browser already has access to.
  await o.evaluate(()=>chrome.storage.local.set({webCapture:{enabled:false,paused:false,allSites:false,domains:['example.com','missing.test'],blocked:[],searches:false,audio:false},settings:{enabled:true,maxAgeDays:0,lightMode:false}}));
  await o.waitForFunction(()=>document.querySelectorAll('#web-sites .site').length===2);
  assert.equal(await o.locator('#web-restore').isVisible(),true,'can bring suggestions back');
  // The list can be collapsed, and its count/icons remain accurate.
  assert.equal(await o.locator('#web-site-count').innerText(),'2');
  await o.locator('#web-site-list > summary').click();assert.equal(await o.locator('#web-sites').isVisible(),false);
  await o.locator('#web-site-list > summary').click();assert.equal(await o.locator('#web-sites').isVisible(),true);
  assert.match(await o.locator('#web-sites img').first().getAttribute('src'),/_favicon\//);
  // Remove a site with its × button.
  await o.locator('#web-sites .site-remove[aria-label="Remove missing.test"]').click();await msg('Removed missing.test');
  assert.deepEqual((await stored()).domains,['example.com']);
  assert.ok((await stored()).blocked.includes('missing.test'));
  // Add a site; a pasted address is cleaned up and lands in "Added by you" or its group.
  await o.locator('#web-domain').fill('https://www.instagram.com/');await o.locator('#web-allow').click();await msg('Added instagram.com');
  assert.deepEqual(await o.locator('#web-sites .site-group:has(h3:text-is("Social")) .site span').allInnerTexts(),['instagram.com']);
  assert.deepEqual(await o.locator('#web-sites .site-group:has(h3:text-is("Added by you")) .site span').allInnerTexts(),['example.com']);
  assert.equal(await o.locator('#web-domain').inputValue(),'');
  await o.locator('#web-domain').fill('instagram.com');await o.locator('#web-domain').press('Enter');await msg('already in the list');
  await o.locator('#web-domain').fill('mail.google.com');await o.locator('#web-allow').click();await msg('private sites');
  // Turn saving on with the switch: one control, plain status.
  await o.locator('#web-enabled').focus();await o.keyboard.press('Space');await msg('Turned on');
  assert.match(await state(),/^On for 2 sites\./);
  let config=await stored();assert.equal(config.enabled,true);assert.equal(config.paused,false);
  assert.equal(await o.locator('#web-access-row').isVisible(),false);
  // A listed site Chrome hasn't allowed yet shows one clear warning with a fix button.
  await o.evaluate(()=>chrome.storage.local.get('webCapture').then(({webCapture})=>chrome.storage.local.set({webCapture:{...webCapture,domains:[...webCapture.domains,'ungranted.test']}})));
  await o.waitForFunction(()=>!document.querySelector('#web-access-row').hidden);
  assert.match(await o.locator('#web-access').innerText(),/hasn't given CueWoven access to ungranted\.test/);
  assert.equal(await o.locator('#web-fix').isVisible(),true);
  // Turn it off: pages stay saved, status says so.
  await o.locator('#web-enabled').uncheck();await msg('Turned off');
  assert.match(await state(),/^Off\./);assert.equal((await stored()).paused,true);
  assert.equal(await o.locator('#web-access-row').isVisible(),false);
  // More options start collapsed; switches report what's on in the summary.
  const more=o.locator('details.fold',{has:o.locator('#web-all')});
  assert.equal(await more.evaluate(n=>n.open),false);
  await more.locator('summary').first().click();
  await o.locator('#web-searches').check();await msg('Web searches will be saved');
  await o.locator('#web-audio').check();await o.waitForFunction(()=>document.querySelector('#web-options-summary').textContent==='Selected: searches, video audio');
  await o.evaluate(()=>chrome.storage.local.get('settings').then(({settings})=>chrome.storage.local.set({settings:{...settings,lightMode:true}})));
  await o.waitForFunction(()=>document.querySelector('#web-options-summary').textContent.includes('paused by Lite mode'));
  await o.evaluate(()=>chrome.storage.local.get(['settings','webCapture']).then(({settings,webCapture})=>chrome.storage.local.set({settings:{...settings,lightMode:false,enabled:false},webCapture:{...webCapture,paused:false}})));
  await o.waitForFunction(()=>document.querySelector('#web-state').textContent.includes('Save automatically is off'));
  await o.evaluate(()=>chrome.storage.local.get(['settings','webCapture']).then(({settings,webCapture})=>chrome.storage.local.set({settings:{...settings,enabled:true},webCapture:{...webCapture,paused:true}})));
  // Exclusions from the popup/API remain manageable without a duplicate removal form.
  assert.equal(await o.locator('#web-forget-domain').count(),0);
  const forgotten=await f.send({type:'web-forget',domain:'example.com'});assert.equal(forgotten.error,undefined);
  await o.locator('#web-exclusions [aria-label="Allow again example.com"]').waitFor();
  assert.ok((await o.locator('#web-exclusions .site span').allInnerTexts()).includes('example.com'));
  assert.equal(await o.locator('#web-sites .site span',{hasText:/^example\.com$/}).count(),0,'forgotten site leaves the list');
  await o.locator('#web-exclusions [aria-label="Allow again example.com"]').click();await msg('can be saved again');
  assert.equal(await o.locator('#web-exclusions [aria-label="Allow again example.com"]').count(),0);
  // Bring the suggested sites back.
  await o.evaluate(()=>{window.realPermission=chrome.permissions.request.bind(chrome.permissions);chrome.permissions.request=async request=>{window.suggestedRequest=request;return true;};});
  await o.locator('#web-restore').click();await msg('suggested sites');
  assert.ok((await o.evaluate(()=>window.suggestedRequest.origins)).includes('https://*.wikipedia.org/*'));
  assert.ok(!(await o.evaluate(()=>window.suggestedRequest.origins)).includes('https://*.instagram.com/*'),'already listed sites need no new request');
  await o.evaluate(()=>chrome.permissions.request=window.realPermission);
  assert.equal((await stored()).domains.length>=SUGGESTED,true);
  // Popup footer says what its button does.
  const popup=await f.context.newPage();await popup.goto(f.base+'/popup/popup.html');
  await popup.waitForFunction(()=>!document.querySelector('#web-pause-popup').hidden);
  assert.equal(await popup.locator('#web-pause-popup').innerText(),'Start saving sites');
  await popup.locator('#web-pause-popup').click();await popup.waitForFunction(()=>document.querySelector('#web-pause-popup').textContent==='Stop saving sites');
  assert.equal(await popup.locator('body').evaluate(n=>n.scrollWidth),440);
  await popup.close();
  await o.waitForFunction(()=>document.querySelector('#web-enabled').checked);
  // Removing a listed site must exclude it even in all-sites mode, without deleting saved items.
  await o.evaluate(()=>chrome.storage.local.set({webCapture:{enabled:false,paused:true,allSites:true,domains:['example.com'],blocked:[],searches:false,audio:false}}));
  await o.waitForFunction(()=>document.querySelectorAll('#web-sites .site').length===1);
  await o.locator('#web-sites .site-remove').click();await msg('Removed example.com');
  config=await stored();assert.ok(config.blocked.includes('example.com'));assert.deepEqual(config.domains,[]);
  assert.equal(await o.evaluate(async()=>{const {policy}=await import(chrome.runtime.getURL('lib/web-items.js'));const {webCapture}=await chrome.storage.local.get('webCapture');return policy.allowed('https://example.com/article',{...webCapture,enabled:true,paused:false});}),false);
  // A blocked parent cannot be bypassed by adding a subdomain.
  await o.locator('#web-domain').fill('news.example.com');await o.locator('#web-allow').click();await msg('Allow example.com again first');
  assert.deepEqual((await stored()).domains,[]);
  await o.locator('#web-exclusions .site-remove').click();await msg('can be saved again');assert.ok((await stored()).domains.includes('example.com'));
  // A denied optional permission leaves the switch and stored choice off.
  await o.evaluate(()=>{window.askPermission=chrome.permissions.request.bind(chrome.permissions);chrome.permissions.request=async()=>false;});
  await o.locator('#web-enabled').click();await msg("didn't give access");assert.equal(await o.locator('#web-enabled').isChecked(),false);assert.equal((await stored()).enabled,false);
  await o.evaluate(()=>chrome.permissions.request=window.askPermission);
  // Long custom domains fit on narrow screens, including their remove buttons.
  const longHost='a'.repeat(60)+'.'+'b'.repeat(60)+'.test';
  await o.evaluate(()=>{window.realPermission=chrome.permissions.request.bind(chrome.permissions);chrome.permissions.request=async request=>{window.addRequest=request;return true;};});
  await o.locator('#web-domain').fill(longHost);await o.locator('#web-allow').click();await msg('Added '+longHost);
  assert.deepEqual(await o.evaluate(()=>window.addRequest.origins),['https://*.'+longHost+'/*','http://*.'+longHost+'/*']);
  await o.evaluate(()=>chrome.permissions.request=window.realPermission);
  // Layout holds from phone to desktop, in both themes.
  await o.setViewportSize({width:390,height:900});await o.emulateMedia({colorScheme:'light'});await o.locator('#sec-websites').screenshot({path:path.join(output,'websites-phone.png')});
  for(const width of [320,768,1024,1440]){await o.setViewportSize({width,height:900});assert.equal(await o.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`no overflow at ${width}`);}
  await o.setViewportSize({width:1280,height:900});
  for(const theme of ['light','dark']){await o.emulateMedia({colorScheme:theme});await o.locator('#sec-websites').screenshot({path:path.join(output,`websites-${theme}.png`)});}
  assert.deepEqual(errors,[]);
  console.log('WEBSITES_PASS: suggested groups, saved-state indicators, add/remove, permission denial, all-sites exclusion, blocked-parent handling, popup control and responsive layouts.');
 }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
