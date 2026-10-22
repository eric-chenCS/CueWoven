const fixture = require('./web-fixture.cjs'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const query = '"warm ocean water"', text = 'Coral bleaching happens when warm ocean water drives away algae.';
const report = {checks: [], errors: []};
(async () => {
 const f = await fixture();
 report.browser = await f.context.browser()?.version();
 f.context.on('weberror', event => report.errors.push(event.error().message));
 try {
  await f.enable();
  await f.context.route('https://i.ytimg.com/**', route => route.fulfill({status: 404, body: ''}));
  await f.options.evaluate(() => chrome.storage.local.set({onboardingComplete: true}));
  await f.context.addInitScript(() => {
   if (!location.pathname.endsWith('/popup/popup.html')) return;
   window.scopeCalls = [];
   chrome.tabs.query = async () => {
    const {scopeFixture: fixture} = await chrome.storage.session.get('scopeFixture');
    return [{id: 99, url: 'https://www.youtube.com/watch?v=' + fixture.id, title: 'Current video'}];
   };
   chrome.tabs.sendMessage = async () => {
    const {scopeFixture: fixture} = await chrome.storage.session.get('scopeFixture');
    return {video: {videoId: fixture.id, title: 'Current video'}};
   };
   const original = chrome.runtime.sendMessage.bind(chrome.runtime);
   chrome.runtime.sendMessage = async message => {
    if (['search', 'video-status', 'index-tab'].includes(message.type)) scopeCalls.push(message);
    if (message.type === 'search' && message.query === 'no match scoped fixture') return {results:[]};
    if (message.type === 'search' && message.query === 'empty scoped fixture') return {empty:true, results:[]};
    if (message.type === 'search' && message.query === 'broken model fixture') return {error:'Controlled model error. Retry to reload it.'};
    if (message.type !== 'index-tab') return original(message);
    const {scopeFixture: fixture} = await chrome.storage.session.get('scopeFixture');
    if (fixture.index === 'captions') {
     const result = await original({target: 'offscreen', type: 'index', method: 'controlled-test', video: {videoId: fixture.id, title: 'Newly captured video', watchedAt: Date.now()}, segments: [{start: 64, text: 'Coral bleaching happens when warm ocean water drives away algae.'}]});
     return {ok: !result.error, ...result};
    }
    return {ok: false, reason: 'Captions unavailable in this controlled fixture.'};
   };
  });
  const seed = async (id, method, start) => {
   const result = await f.send({target: 'offscreen', type: 'index', method, video: {videoId: id, title: 'Ocean lesson ' + id, watchedAt: Date.now()}, segments: [{start, text}]});
   assert.equal(result.error, undefined);
  };
  await seed('scope000001', 'controlled-test', 42);
  await seed('scope000002', 'controlled-test', 80);
  await seed('scope000003', 'speech-local', 123);
  const popup = async (id, index = 'fail') => {
   await f.options.evaluate(value => chrome.storage.session.set({lastQuery: '', scopeFixture: value}), {id, index});
   const page = await f.context.newPage();
   await page.goto(f.base + '/popup/popup.html');
   await page.locator('#video-scope-row').waitFor({state: 'visible'});
   await page.locator('#video-scope').check();
   return page;
  };
  const search = async (page, value = query) => {
   await page.locator('#q').fill(value);
   await page.locator('#q').press('Enter');
   await page.waitForFunction(() => document.querySelector('.result') || !document.querySelector('#search-retry').hidden || document.querySelector('.empty h2')?.textContent === 'Add one more detail', null, {timeout: 120000});
  };
  const expectSaved = async (id, start, source) => {
   const page = await popup(id);
   await search(page);
   const snapshot = await page.evaluate(() => ({href: document.querySelector('.result')?.getAttribute('href'), source: document.querySelector('.match-sources')?.textContent, calls: scopeCalls, message: document.querySelector('.empty')?.textContent}));
   report.checks.push({id, ...snapshot});
   assert.equal(snapshot.href, `https://www.youtube.com/watch?v=${id}&t=${start}s`, JSON.stringify(snapshot));
   assert.match(snapshot.source, new RegExp(source));
   assert.equal(snapshot.calls.filter(call => call.type === 'index-tab').length, 0, 'saved evidence must not require another caption fetch');
   assert.equal(snapshot.calls.find(call => call.type === 'search').videoId, id);
   assert.equal(await page.locator('.result').count(), 1, 'the scope excludes matching videos elsewhere in the library');
   return page;
  };
  const captionPage = await expectSaved('scope000001', 42, 'Transcript');
  await captionPage.locator('#video-scope').uncheck();
  await captionPage.waitForFunction(() => scopeCalls.at(-1)?.type === 'search' && scopeCalls.at(-1).videoId === undefined && document.querySelector('.others-head'));
  await captionPage.close();
  const noMoment = await popup('scope000001');
  await search(noMoment, 'no match scoped fixture');
  assert.equal(await noMoment.locator('.empty h2').innerText(), 'Add one more detail');
  assert.match(await noMoment.locator('#refine-question').innerText(), /match scoped fixture/);
  assert.equal(await noMoment.locator('#search-retry').isVisible(), false, 'an ordinary no-match is not a search failure');
  assert.equal(await noMoment.locator('#refine').isVisible(), true);
  if (process.env.RECALL_SCREENSHOT_DIR) await noMoment.screenshot({path: path.join(process.env.RECALL_SCREENSHOT_DIR, 'cuewoven-video-no-moment.png')});
  await search(noMoment, 'empty scoped fixture');
  assert.equal(await noMoment.locator('.empty h2').innerText(), 'Add one more detail', 'empty engine response still offers scoped guidance');
  await search(noMoment, 'broken model fixture');
  assert.equal(await noMoment.locator('.empty h2').innerText(), 'Couldn’t search this video');
  assert.match(await noMoment.locator('.empty').innerText(), /Controlled model error/);
  assert.equal(await noMoment.locator('#search-retry').isVisible(), true, 'actual errors retain diagnostics and retry');
  await noMoment.locator('#video-scope').uncheck();
  await noMoment.waitForFunction(() => document.querySelector('.empty h2')?.textContent === 'Search failed');
  await noMoment.close();
  report.checks.push({noMatchingMomentMessage: true});
  // The real engine can search this audio; previously the popup blocked it first.
  const audio = await f.send({type: 'search', query, videoId: 'scope000003', distinct: true});
  assert.equal(audio.results[0].start, 123);
  assert.deepEqual(audio.results[0].matchSources, ['Audio']);
  await (await expectSaved('scope000003', 123, 'Audio')).close();
  // Already captured evidence remains searchable when new saving is paused.
  await f.options.evaluate(() => chrome.storage.local.set({settings: {enabled: false, maxAgeDays: 0}}));
  await (await expectSaved('scope000003', 123, 'Audio')).close();
  await f.enable();
  // A metadata-only video still attempts to obtain its initial caption passages.
  const metadata = await f.send({target: 'offscreen', type: 'import-history', videos: [{videoId: 'scope000004', title: 'Fourth session', watchedAt: Date.now()}]});
  assert.equal(metadata.error, undefined);
  const metadataStatus = await f.send({target: 'offscreen', type: 'has', videoId: 'scope000004'});
  assert.equal(metadataStatus.content, false, 'a title is not searchable moment evidence');
  const fresh = await popup('scope000004', 'captions');
  await search(fresh);
  assert.equal(await fresh.locator('.result').getAttribute('href'), 'https://www.youtube.com/watch?v=scope000004&t=64s');
  assert.equal(await fresh.evaluate(() => scopeCalls.filter(call => call.type === 'index-tab').length), 1);
  await fresh.close();
  report.checks.push({freshCapture: true, metadataOnlyCapture: true, pausedSavedAudio: true, toggleScopeOff: true});
  // No captured content plus failed capture must report the error, not search everything.
  const unavailable = await popup('scope000005');
  await search(unavailable);
  assert.match(await unavailable.locator('.empty').innerText(), /Captions unavailable/);
  assert.equal(await unavailable.locator('.empty h2').innerText(), 'Couldn’t search this video');
  assert.equal(await unavailable.locator('#search-retry').isVisible(), true);
  assert.equal(await unavailable.evaluate(() => scopeCalls.some(call => call.type === 'search')), false);
  await unavailable.close();
  report.checks.push({missingEvidenceError: true});
  // Burned-in text is also usable without a downloaded transcript.
  await f.enable({ocr: true});
  const screen = await f.options.evaluate(async () => {
   const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
   const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1280, 720);
   ctx.fillStyle = 'black'; ctx.font = '40px Arial';
   ctx.fillText('Coral bleaching happens when warm ocean water', 50, 300);
   ctx.fillText('drives away algae.', 50, 360);
   return chrome.runtime.sendMessage({target: 'offscreen', type: 'screen-index', video: {videoId: 'scope000007', title: 'Seventh session', watchedAt: Date.now()}, start: 210, image: canvas.toDataURL('image/jpeg', .9)});
  });
  assert.equal(screen.error, undefined); assert.equal(screen.empty, undefined); assert.equal(screen.busy, undefined);
  await (await expectSaved('scope000007', 207, 'On-screen text')).close();
  report.checks.push({realOcr: true, observedTimestamp: 210, playbackTimestamp: 207});
  // Exercise the real CLIP path with an original, generated scene fixture.
  const scene = await f.options.evaluate(async () => {
   const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
   const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 320, 180);
   ctx.fillStyle = 'red'; ctx.fillRect(90, 20, 140, 140);
   return chrome.runtime.sendMessage({target: 'offscreen', type: 'scene-index', video: {videoId: 'scope000006', title: 'Sixth session', watchedAt: Date.now()}, start: 156, image: canvas.toDataURL('image/jpeg', .8)});
  });
  assert.equal(scene.error, undefined); assert.equal(scene.busy, undefined);
  const sceneStatus = await f.send({target: 'offscreen', type: 'has', videoId: 'scope000006'});
  assert.equal(sceneStatus.has, false); assert.equal(sceneStatus.textContent, false); assert.equal(sceneStatus.content, true);
  const visualPage = await popup('scope000006');
  await search(visualPage, 'a red square on a white background');
  assert.equal(await visualPage.locator('.result').getAttribute('href'), 'https://www.youtube.com/watch?v=scope000006&t=156s');
  assert.match(await visualPage.locator('.match-sources').innerText(), /Scene/);
  assert.equal(await visualPage.evaluate(() => scopeCalls.some(call => call.type === 'index-tab')), false);
  report.checks.push({sceneOnlyTimestamp: 156, realClip: true});
  if (process.env.RECALL_SCREENSHOT_DIR) await visualPage.locator('body').screenshot({path: path.join(process.env.RECALL_SCREENSHOT_DIR, 'cuewoven-video-scope.png')});
  await visualPage.close();
  assert.deepEqual(report.errors, []);
  report.passed = true;
  console.log('VIDEO_SCOPE_PASS', JSON.stringify(report));
 } finally {
  if (process.env.RECALL_REPORT_DIR) fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR, 'cuewoven-video-scope.json'), JSON.stringify(report, null, 2));
  await f.close();
 }
})().catch(error => {console.error(error); process.exitCode = 1;});
