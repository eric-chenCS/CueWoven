// First-run welcome: opt-in site groups, one permission request, denial and "YouTube only" paths.
// Chrome's permission dialog can't be clicked by automation, so chrome.permissions.request is answered in-page.
// Usage: node tests/browser/welcome-sites.cjs
const {chromium} = require(process.env.RECALL_PLAYWRIGHT || 'playwright');
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert/strict');
const root = process.env.RECALL_EXTENSION || path.resolve(__dirname, '../..');
async function fresh(answer) {
  const context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cw-welcome-')), {
    executablePath: process.env.RECALL_BROWSER, headless: true, args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`], viewport: {width: 1000, height: 900},
  });
  await context.addInitScript(answer => { window.asked = []; chrome.permissions.request = async request => { window.asked.push(request); return answer; }; }, answer);
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/options/options.html#welcome`);
  await page.bringToFront();
  await page.waitForFunction(() => document.querySelector('#welcome').hidden === false);
  const webCapture = () => page.evaluate(async () => (await chrome.storage.local.get('webCapture')).webCapture);
  return {context, page, errors, webCapture};
}
(async () => {
  // 1. Choose News and Reference, allow access.
  let {context, page, errors, webCapture} = await fresh(true);
  try {
    assert.deepEqual(await page.locator('#welcome-groups strong').allInnerTexts(), ['News', 'Reference', 'Social']);
    assert.equal(await page.locator('#welcome-groups input:checked').count(), 0, 'every group starts off');
    console.log('hints:', await page.locator('#welcome-groups .hint').allInnerTexts());
    await page.locator('#welcome-groups input[data-group="News"]').check();
    await page.locator('#welcome-groups input[data-group="Reference"]').check();
    for (const theme of ['light', 'dark']) {
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
      await page.waitForTimeout(150);
      await page.locator('#welcome').screenshot({path: path.join(process.env.RECALL_SCREENSHOT_DIR || os.tmpdir(), `recall-welcome-${theme}.png`), animations: 'disabled'});
    }
    await page.locator('#welcome-empty').click();
    await page.waitForFunction(() => document.querySelector('#welcome').hidden === true);
    const asked = await page.evaluate(() => window.asked);
    assert.equal(asked.length, 1, 'one permission request');
    const saved = await webCapture();
    assert.ok(saved.domains.includes('nytimes.com') && saved.domains.includes('wikipedia.org') && !saved.domains.includes('reddit.com'));
    assert.equal(saved.enabled, true); assert.equal(saved.paused, false);
    console.log('origins asked:', asked[0].origins.length, '| domains saved:', saved.domains.length, '|', await page.locator('#startup-msg').innerText());
    assert.equal(await page.evaluate(async () => (await chrome.storage.local.get('onboardingComplete')).onboardingComplete), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }

  // 2. Choose Social, deny access: nothing saved, welcome stays with an explanation.
  ({context, page, errors, webCapture} = await fresh(false));
  try {
    await page.locator('#welcome-groups input[data-group="Social"]').check();
    await page.locator('#welcome-empty').click();
    await page.waitForFunction(() => document.querySelector('#welcome-msg').textContent);
    console.log('denied:', await page.locator('#welcome-msg').innerText());
    assert.equal(await page.locator('#welcome').isVisible(), true);
    assert.deepEqual((await webCapture()).domains, ['youtube.com']);
    // 3. Turn it back off and start with YouTube only: no browser prompt at all.
    await page.locator('#welcome-groups input[data-group="Social"]').uncheck();
    await page.evaluate(() => { window.asked = []; });
    await page.locator('#welcome-empty').click();
    await page.waitForFunction(() => document.querySelector('#welcome').hidden === true);
    assert.equal((await page.evaluate(() => window.asked)).length, 0, 'YouTube only asks for nothing');
    console.log('youtube only:', await page.locator('#startup-msg').innerText());
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  console.log('WELCOME_SITES_PASS: groups start off, one permission request for chosen groups, denial keeps welcome and changes nothing, YouTube only asks for nothing.');
})().catch(e => { console.error(e); process.exitCode = 1; });
