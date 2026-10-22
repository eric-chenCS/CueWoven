const fixture = require('./web-fixture.cjs'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const report = {checks:[], errors:[]}, gib = 1024 ** 3;
const directory = process.env.RECALL_REPORT_DIR;
if (directory) fs.mkdirSync(directory, {recursive:true});

async function run({name, capacity, stored, failed = false, real = false, verify}) {
 const f = await fixture({prepareExtension(extension) {
  if (real) return;
  const file = path.join(extension, 'background.js'), source = fs.readFileSync(file, 'utf8');
  // Only the isolated copy substitutes RAM. Production detection is checked separately.
  fs.writeFileSync(file, `const testSeed = ${stored ? `chrome.storage.local.set(${JSON.stringify(stored)})` : 'Promise.resolve()'};\nchrome.system.memory.getInfo = async () => {await testSeed;${failed ? "throw Error('Controlled hardware failure');" : `return {capacity:${capacity},availableCapacity:1};`}};\n${source}`);
 }});
 f.context.on('weberror', event => report.errors.push(event.error().message));
 try {
  report.browser = await f.context.browser()?.version();
  await f.options.waitForFunction(() => document.querySelector('#maxAgeDays').value === '28');
  const defaults = await f.send({type:'settings-defaults'});
  const state = await f.options.evaluate(() => chrome.storage.local.get(['settings', 'liteModeInitialized']));
  assert.equal(defaults.error, undefined);
  await verify(f, defaults, state);
  report.checks.push(name);
 } finally { await f.close(); }
}

(async () => {
 await run({name:'real Edge physical-memory permission and full default on this laptop', real:true, verify:async(f, defaults, state) => {
  const info = await f.options.evaluate(async () => ({capacity:(await chrome.system.memory.getInfo()).capacity, approximate:navigator.deviceMemory, granted:await chrome.permissions.contains({permissions:['system.memory']})}));
  assert.ok(Number.isFinite(info.capacity) && info.capacity > 0);
  assert.equal(info.granted,true);
  assert.equal(defaults.lightMode,info.capacity <= 8*gib);
  assert.equal(state.settings.lightMode,defaults.lightMode);
  report.realHardware = info;
 }});
 await run({name:'8 GiB fresh install, real text search, media gates, manual override and device-aware reset', capacity:8*gib, verify:async(f, defaults, state) => {
  assert.equal(defaults.lightMode, true); assert.equal(state.settings.lightMode, true); assert.equal(state.liteModeInitialized, true);
  assert.equal(await f.options.locator('#lightMode').isChecked(), true);
  assert.match(await f.options.locator('label').filter({has:f.options.locator('#lightMode')}).innerText(), /8 GB RAM or less/);
  for (const id of ['speechEnabled','scenesEnabled','screenTextEnabled']) assert.equal(await f.options.locator('#'+id).isDisabled(), true);
  // These real service-worker gates must stop before player or model access.
  for (const type of ['speech-auto-start','scene-frame','screen-frame']) assert.deepEqual(await f.send({type}), {disabled:true});
  assert.equal((await f.send({type:'youtube-saving-status'})).error !== undefined, true, 'offscreen-only status remains private');
  await f.options.evaluate(() => chrome.storage.local.set({webCapture:{enabled:true, domains:['example.com'], blocked:[], paused:false}}));
  assert.equal((await f.send({type:'web-sync'})).error, undefined);
  const indexed = await f.send({target:'offscreen',type:'index',method:'controlled-test',video:{videoId:'liteReef001',title:'Coral observations',watchedAt:Date.now()},segments:[{start:42,text:'Coral bleaching occurs when warm ocean water drives away symbiotic algae.'}]});
  assert.equal(indexed.error, undefined);
  const found = await f.send({type:'search',query:'why coral turns white in warmer seas'});
  assert.equal(found.error, undefined); assert.equal(found.results[0].videoId,'liteReef001');
  report.textSearch = {videoId:found.results[0].videoId, start:found.results[0].start};
  const library = await f.send({type:'list'});
  for (const width of [320, 768, 1024, 1440]) {
   await f.options.setViewportSize({width,height:900});
   assert.ok(await f.options.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow at '+width);
  }
  await f.options.setViewportSize({width:1000,height:900});
  if (directory) await f.options.locator('#sec-capture').screenshot({path:path.join(directory,'cuewoven-auto-lite.png')});
  await f.options.locator('#lightMode').uncheck();
  await f.wait(() => f.options.evaluate(() => chrome.storage.local.get('settings').then(({settings}) => settings.lightMode === false)));
  await f.options.reload(); await f.options.waitForFunction(() => document.querySelector('#speechEnabled').disabled === false);
  assert.equal(await f.options.locator('#lightMode').isChecked(), false);
  for (const id of ['speechEnabled','scenesEnabled','screenTextEnabled']) assert.equal(await f.options.locator('#'+id).isChecked(), id !== 'scenesEnabled');
  // Hold device setup pending: a manual switch must wait before reading/writing settings.
  await f.options.evaluate(() => {
   const original = chrome.runtime.sendMessage.bind(chrome.runtime);
   const storageGet = chrome.storage.local.get.bind(chrome.storage.local);
   window.pendingDevice = {waiting:false, reads:0};
   chrome.runtime.sendMessage = message => message.type === 'settings-defaults' ? new Promise(resolve => {
    pendingDevice.waiting = true;
    pendingDevice.finish = async () => resolve(await original(message));
   }) : original(message);
   chrome.storage.local.get = (...args) => {if (args[0] === 'settings') pendingDevice.reads++; return storageGet(...args);};
   pendingDevice.restore = () => {chrome.runtime.sendMessage = original; chrome.storage.local.get = storageGet;};
  });
  await f.options.locator('#lightMode').check();
  await f.options.waitForFunction(() => pendingDevice.waiting);
  assert.equal(await f.options.evaluate(() => pendingDevice.reads), 0, 'save must await initialization before taking its settings snapshot');
  await f.options.evaluate(() => pendingDevice.finish());
  await f.wait(() => f.options.evaluate(() => chrome.storage.local.get('settings').then(({settings}) => settings.lightMode === true)));
  await f.options.evaluate(() => pendingDevice.restore());
  await f.options.locator('#lightMode').uncheck();
  await f.wait(() => f.options.evaluate(() => chrome.storage.local.get('settings').then(({settings}) => settings.lightMode === false)));
  // An initialization failure must not save a partial/default form over preferences.
  await f.options.evaluate(() => {
   window.sendBeforeFailure = chrome.runtime.sendMessage.bind(chrome.runtime);
   chrome.runtime.sendMessage = message => message.type === 'settings-defaults' ? Promise.resolve({error:'Controlled setup failure'}) : sendBeforeFailure(message);
  });
  await f.options.locator('#lightMode').check();
  await f.options.waitForFunction(() => document.querySelector('#saved').textContent.includes('Could not save settings: Controlled setup failure'));
  assert.equal(await f.options.evaluate(() => chrome.storage.local.get('settings').then(({settings}) => settings.lightMode)), false);
  await f.options.evaluate(() => chrome.runtime.sendMessage = sendBeforeFailure);
  await f.options.reload(); await f.options.waitForFunction(() => document.querySelector('#speechEnabled').disabled === false);
  await f.options.locator('#maxAgeDays').selectOption('7');
  await f.wait(() => f.options.evaluate(() => chrome.storage.local.get('settings').then(({settings}) => settings.maxAgeDays === 7)));
  await f.options.locator('#reset-settings').click();
  await f.options.waitForFunction(() => document.querySelector('#reset-msg').textContent.startsWith('Settings reset'));
  assert.equal(await f.options.locator('#lightMode').isChecked(), true);
  assert.equal(await f.options.locator('#maxAgeDays').inputValue(), '7');
  assert.deepEqual(await f.send({type:'list'}), library, 'reset keeps saved records');
 }});
 await run({name:'16 GiB stays full despite low free RAM', capacity:16*gib, verify:async(f, defaults, state) => {
  assert.equal(defaults.lightMode, false); assert.equal(state.settings.lightMode, false);
  assert.equal(await f.options.locator('#lightMode').isChecked(), false);
  assert.equal(await f.options.locator('#speechEnabled').isDisabled(), false);
 }});
 await run({name:'first upgrade on 8 GiB applies Lite and preserves previous settings', capacity:8*gib, stored:{settings:{lightMode:false,enabled:false,speechEnabled:false,maxAgeDays:28,dwellSeconds:30}}, verify:async(f, defaults, state) => {
  assert.equal(state.settings.lightMode,true); assert.equal(state.settings.enabled,false);
  assert.equal(state.settings.speechEnabled,false); assert.equal(state.settings.dwellSeconds,30);
 }});
 await run({name:'saved manual off choice on 8 GiB survives a fresh worker/install event', capacity:8*gib, stored:{settings:{lightMode:false,maxAgeDays:28},liteModeInitialized:true}, verify:async(f, defaults, state) => {
  assert.equal(defaults.lightMode,true); assert.equal(state.settings.lightMode,false);
  assert.equal(await f.options.locator('#lightMode').isChecked(),false);
 }});
 await run({name:'hardware API failure keeps the normal default and Settings usable', failed:true, verify:async(f, defaults, state) => {
  assert.equal(defaults.lightMode,false); assert.equal(state.settings.lightMode,false); assert.equal(state.liteModeInitialized,false);
  await f.options.locator('#lightMode').check();
  await f.wait(() => f.options.evaluate(() => chrome.storage.local.get('liteModeInitialized').then(value => value.liteModeInitialized)));
 }});
 assert.deepEqual(report.errors, []);
 report.pass = true;
 console.log('DEVICE_LITE_PASS', JSON.stringify(report));
})().catch(error => {report.error = error.stack;console.error(error);process.exitCode=1;}).finally(() => {
 if (directory) fs.writeFileSync(path.join(directory,'cuewoven-device-lite.json'),JSON.stringify(report,null,2));
});
