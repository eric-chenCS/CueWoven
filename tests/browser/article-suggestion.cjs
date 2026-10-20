const fixture = require('./web-fixture.cjs'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const text = 'Coral bleaching occurs when warm ocean water drives away symbiotic algae. The coral turns white and loses an important source of food.';
const report = {checks: [], errors: []};
(async () => {
 const f = await fixture(); report.browser = await f.context.browser().version();
 f.context.on('weberror', event => report.errors.push(event.error().message));
 try {
  await f.enable();
  await f.options.evaluate(() => chrome.storage.local.set({onboardingComplete: true}));
  await f.context.route('https://articles.example.com/**', route => {
   const pathname = new URL(route.request().url()).pathname, delayed = pathname.includes('delayed'), contents = pathname.includes('contents');
   const paragraph = '<p id="target">' + text + '</p>';
   return route.fulfill({contentType: 'text/html; charset=utf-8', body: `<!doctype html><title>Coral observations</title><style>body{font:18px/1.6 Arial;margin:24px}button,input{font:inherit}article{max-width:680px}</style><button id="site-button" onclick="this.textContent='Website button worked'">Website button</button><input id="editor" aria-label="Website input"><div style="height:1400px"></div><article${contents ? ' id="target" style="display:contents"' : ''}>${delayed ? '' : contents ? text : paragraph}</article><div style="height:1600px"></div>${delayed ? '<script>setTimeout(()=>document.querySelector("article").innerHTML=' + JSON.stringify(paragraph) + ',1700)</script>' : ''}`});
  });
  const captured = await f.send({target: 'offscreen', type: 'web-capture', kind: 'page', url: 'https://articles.example.com/reef', title: 'Coral observations', text});
  assert.equal(captured.error, undefined);
  const popup = await f.context.newPage(); await popup.goto(f.base + '/popup/popup.html');
  await popup.locator('#kind-filter').selectOption('page');
  await popup.locator('#q').fill('why coral turns white in warm seas'); await popup.locator('#q').press('Enter');
  await popup.locator('.result').first().waitFor({timeout: 120000});
  const href = await popup.locator('.result').first().getAttribute('href');
  assert.ok(href.includes('recall-suggest=1'), href); assert.ok(!href.includes(':~:text='));
  await popup.close();
  const open = async (url = href) => {
   const page = await f.context.newPage(); await page.goto(url);
   await page.locator('[data-cuewoven-suggestion]').waitFor();
   // Let the automatic jump settle before testing user interaction.
   await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
   assert.equal(await page.evaluate(() => CSS.highlights?.has('cuewoven-passage') || false), false);
   assert.equal(await page.locator('[data-cuewoven-suggestion]').innerText(), 'Suggested section · Similar in meaning');
   return page;
  };
  const initial = await open();
  const position = await initial.locator('#target').boundingBox();
  assert.ok(position.y >= 0 && position.y < 800, 'semantic suggestion scrolls to the saved section');
  report.checks.push({name: 'real semantic search scrolls without text highlighting', position});
  if (process.env.RECALL_REPORT_DIR) await initial.screenshot({path: path.join(process.env.RECALL_REPORT_DIR, 'cuewoven-semantic-suggestion.png')});
  await initial.close();
  const contentsPage = await open(href.replace('/reef#', '/contents#'));
  const contentsPosition = await contentsPage.evaluate(() => {
   const range = document.createRange(); range.selectNodeContents(document.querySelector('#target'));
   return {top: range.getBoundingClientRect().top, bottom: range.getBoundingClientRect().bottom};
  });
  assert.ok(contentsPosition.top >= 0 && contentsPosition.bottom <= 800, JSON.stringify(contentsPosition));
  assert.equal(await contentsPage.locator('[data-cuewoven-suggestion]').count(), 1);
  report.checks.push({name: 'offscreen text inside a boxless wrapper scrolls into view', position: contentsPosition});
  await contentsPage.close();
  for (const [name, interact] of [
   ['click', page => page.locator('#target').click()],
   ['keyboard', page => page.keyboard.press('ArrowDown')],
   ['wheel', page => page.mouse.wheel(0, 140)],
   ['scroll', page => page.evaluate(() => scrollBy(0, 140))],
   ['typing', async page => {await page.locator('#editor').focus(); await page.keyboard.type('hello'); assert.equal(await page.locator('#editor').inputValue(), 'hello');}],
   ['touch', async page => {
    const cdp = await f.context.newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 1});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 100, y: 400}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await cdp.detach();
   }],
  ]) {
   const page = await open(); await interact(page);
   await page.locator('[data-cuewoven-suggestion]').waitFor({state: 'detached'});
   assert.equal(await page.locator('[data-cuewoven-suggestion]').count(), 0);
   report.checks.push({name: 'dismiss on ' + name, passed: true}); await page.close();
  }
  // Dismissing a pending suggestion also cancels later auto-scroll and label creation.
  const delayed = await f.context.newPage(); await delayed.goto(href.replace('/reef#', '/delayed#'));
  await delayed.locator('#site-button').click();
  await delayed.locator('#target').waitFor(); await delayed.waitForTimeout(2100);
  assert.equal(await delayed.locator('#site-button').innerText(), 'Website button worked');
  assert.equal(await delayed.locator('[data-cuewoven-suggestion]').count(), 0);
  assert.equal(await delayed.evaluate(() => scrollY), 0);
  report.checks.push({name: 'interaction cancels pending late-render suggestion and preserves website click', passed: true});
  await delayed.close();
  // Literal matches retain their exact highlight and do not show a suggestion label.
  const exactUrl = await f.options.evaluate(async text => {
   const {resultLink} = await import(chrome.runtime.getURL('lib/result-link.js'));
   return resultLink({videoId: 'web_' + 'a'.repeat(64), url: 'https://articles.example.com/exact', kind: 'page', pageText: true, text}, 'warm ocean water');
  }, text);
  const exact = await f.context.newPage(); await exact.goto(exactUrl);
  await exact.waitForFunction(() => CSS.highlights?.get('cuewoven-passage')?.size);
  assert.equal(await exact.locator('[data-cuewoven-suggestion]').count(), 0);
  assert.equal(await exact.evaluate(() => [...CSS.highlights.get('cuewoven-passage')][0].toString()), 'warm ocean water');
  report.checks.push({name: 'exact wording keeps its phrase highlight', passed: true}); await exact.close();
  assert.deepEqual(report.errors, []); report.passed = true;
  console.log('ARTICLE_SUGGESTION_PASS', JSON.stringify(report));
 } finally {
  if (process.env.RECALL_REPORT_DIR) fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR, 'cuewoven-article-suggestion.json'), JSON.stringify(report, null, 2));
  await f.close();
 }
})().catch(error => {console.error(error); process.exitCode = 1;});
