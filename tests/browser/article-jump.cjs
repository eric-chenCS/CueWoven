const fixture = require('./web-fixture.cjs'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const phrase = 'Warm ocean water drives away symbiotic algae';
const report = {checks: [], errors: []};
(async () => {
 const f = await fixture();
 report.browser = await f.context.browser().version();
 f.context.on('weberror', event => report.errors.push(event.error().message));
 try {
  assert.equal((await f.send({type:'settings-defaults'})).error, undefined);
  await f.enable();
  await f.options.evaluate(() => chrome.storage.local.set({onboardingComplete: true}));
  const prefix = Array.from({length: 95}, (_, i) => 'introduction' + i).join(' ');
  const suffix = 'from fragile coral reefs after prolonged heat stress. Recovery depends on cooler conditions.';
  const text = prefix + ' ' + phrase + ' ' + suffix;
  let body = `<article><p id="intro">${prefix}</p><div style="height:1400px"></div><p id="target">${phrase} ${suffix}</p></article>`;
  await f.context.route('https://articles.example.com/**', route => route.fulfill({contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>Reef observations</title>' + body}));
  const captured = await f.send({target: 'offscreen', type: 'web-capture', kind: 'page', url: 'https://articles.example.com/reef', title: 'Reef observations', text});
  assert.equal(captured.error, undefined);
  const popup = await f.context.newPage(); await popup.goto(f.base + '/popup/popup.html');
  await popup.locator('#kind-filter').selectOption('page');
  await popup.locator('#q').fill('"' + phrase + '"'); await popup.locator('#q').press('Enter');
  await popup.locator('.result').first().waitFor({timeout: 120000});
  const href = await popup.locator('.result').first().getAttribute('href');
  report.href = href;
  const page = await f.context.newPage(); await page.goto(href);
   await page.waitForFunction(() => CSS.highlights?.get('cuewoven-passage')?.size);
  const selected = await page.evaluate(() => {
   const range = [...CSS.highlights.get('cuewoven-passage')][0], rect = range.getBoundingClientRect();
   return {text: range.toString(), parent: range.startContainer.parentElement.id, top: rect.top, bottom: rect.bottom, height: innerHeight};
  });
  report.checks.push({name: 'exact phrase beyond opening twenty words', ...selected});
  assert.ok(selected.text.includes(phrase), JSON.stringify(selected));
  assert.equal(selected.parent, 'target');
  assert.ok(selected.top >= 0 && selected.top < selected.height, 'matched passage must be visible');
  if (process.env.RECALL_REPORT_DIR) await page.screenshot({path: path.join(process.env.RECALL_REPORT_DIR, 'cuewoven-article-jump.png')});
  await page.close();
  // An unquoted literal search chooses the same phrase; copying uses that same destination.
  await popup.locator('#q').fill(phrase); await popup.locator('#q').press('Enter');
  await popup.waitForFunction(phrase => {
   const href = document.querySelector('.result')?.getAttribute('href');
   return href && new URLSearchParams(new URL(href).hash.slice(1).split(':~:')[0]).get('recall-text') === phrase;
  }, phrase);
  await popup.evaluate(() => Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async value => window.copiedArticle = value}}));
  await popup.locator('.copy-link').first().click();
  assert.equal(await popup.evaluate(() => copiedArticle), await popup.locator('.result').first().getAttribute('href'));
  report.checks.push({name: 'unquoted literal and copied link', passed: true});
  await popup.close();
  const navigate = async (name, html, savedText, query, expected, parent = 'target', exact = true) => {
   body = html;
   const url = await f.options.evaluate(async ({savedText, query}) => {
    const {resultLink} = await import(chrome.runtime.getURL('lib/result-link.js'));
    return resultLink({videoId: 'web_' + 'a'.repeat(64), url: 'https://articles.example.com/' + crypto.randomUUID(), kind: 'page', pageText: true, text: savedText}, query);
   }, {savedText, query});
   const targetPage = await f.context.newPage(); await targetPage.goto(url);
   if (!exact) {
    await targetPage.locator('[data-cuewoven-suggestion]').waitFor();
    assert.equal(await targetPage.evaluate(() => CSS.highlights?.has('cuewoven-passage') || false), false);
    assert.ok(!url.includes(':~:text='));
    report.checks.push({name, suggestion: true, highlighted: false});
    await targetPage.close(); return;
   }
   await targetPage.waitForFunction(() => CSS.highlights?.get('cuewoven-passage')?.size);
   const found = await targetPage.evaluate(() => {
    const range = [...CSS.highlights.get('cuewoven-passage')][0];
    const box = range.getBoundingClientRect();
    return {text: range.toString(), parent: range.startContainer.parentElement.closest('[id]')?.id, top:box.top, bottom:box.bottom, viewport:innerHeight};
   });
   assert.equal(found.parent, parent, name + ': ' + JSON.stringify(found));
   if (exact) assert.equal(found.text, expected, name); else assert.ok(found.text.includes(expected), name);
   assert.ok(found.top >= 0 && found.bottom <= found.viewport, name + ': matched text must be visible: ' + JSON.stringify(found));
   report.checks.push({name, ...found}); await targetPage.close();
  };
  await navigate('repeated phrase in navigation', `<nav>${phrase} in the menu.</nav><div style="height:1400px"></div><article><p id="target">${text}</p></article>`, text, phrase, phrase);
  await navigate('repeated phrase in an article teaser', `<article><p>${phrase} but this teaser discusses a different reef.</p><div style="height:1400px"></div><p id="target">${text}</p></article>`, text, phrase, phrase);
  await navigate('adjacent block elements without source whitespace', `<article><h2 id="target">Reef observations</h2><p>${phrase} ${suffix}</p></article>`, 'Reef observations\n' + phrase + ' ' + suffix, '', phrase, 'target', false);
  await navigate('inline formatting keeps the sentence intact', `<article><p id="target">Warm <strong>ocean</strong> water drives away <em>symbiotic</em> algae ${suffix}</p></article>`, phrase + ' ' + suffix, phrase, phrase);
  await navigate('visible paragraphs within display contents wrappers', `<article style="display:contents"><p id="target">${phrase} ${suffix}</p></article>`, phrase + ' ' + suffix, phrase, phrase);
  await navigate('visible direct text within display contents wrappers', `<article id="target" style="display:contents">${phrase} ${suffix}</article>`, phrase + ' ' + suffix, phrase, phrase);
  await navigate('line breaks remain word boundaries', `<article><p id="target">Warm ocean water<br>drives away symbiotic algae ${suffix}</p></article>`, phrase + ' ' + suffix, phrase, 'Warm ocean waterdrives away symbiotic algae');
  await navigate('line breaks after inline formatting remain word boundaries', `<article><p id="target"><strong>Warm ocean water</strong><br>drives away symbiotic algae ${suffix}</p></article>`, phrase + ' ' + suffix, phrase, 'Warm ocean waterdrives away symbiotic algae');
  const longPhrase = 'The ocean temperature remains unusually high while the coral loses its symbiotic algae and gradually turns white because prolonged heat stress disrupts its ordinary source of food';
  await navigate('literal phrases longer than twenty words', `<article><p id="target">${longPhrase}</p></article>`, longPhrase, longPhrase, longPhrase);
  await navigate('curly punctuation on the current page', '<article><p id="target">The reef’s warm‑water stress spreads fast.</p></article>', "The reef's warm-water stress spreads fast.", "reef's warm-water stress", 'reef’s warm‑water stress');
  await navigate('offscreen exact text in a boxless wrapper when native punctuation matching misses', '<div style="height:1400px"></div><article id="target" style="display:contents">The reef’s warm‑water stress spreads fast.</article><div style="height:1400px"></div>', "The reef's warm-water stress spreads fast.", "reef's warm-water stress", 'reef’s warm‑water stress');
  // An earlier partial match must not preempt a complete phrase that renders later.
  await navigate('late rendering does not jump to an earlier partial phrase', `<article><p>${phrase.split(' ').slice(0, 4).join(' ')} but this text is unrelated.</p><div style="height:1400px"></div><div id="late"></div></article><script>setTimeout(()=>document.querySelector('#late').innerHTML='<p id="target">${phrase} ${suffix}</p>',1700)</script>`, phrase + ' ' + suffix, phrase, phrase);
  await navigate('late rendering waits past an earlier complete phrase with different context', `<nav>${phrase} in the navigation menu.</nav><div style="height:1400px"></div><article id="late"></article><script>setTimeout(()=>document.querySelector('#late').innerHTML='<p id="target">${phrase} ${suffix}</p>',1700)</script>`, phrase + ' ' + suffix, phrase, phrase);
  body = '<article><p>Warm ocean water drives but the saved sentence was removed.</p></article>';
  const missingUrl = await f.options.evaluate(async phrase => {
   const {resultLink} = await import(chrome.runtime.getURL('lib/result-link.js'));
   return resultLink({videoId: 'web_' + 'a'.repeat(64), url: 'https://articles.example.com/removed', kind: 'page', pageText: true, text: phrase}, phrase);
  }, phrase);
  const missing = await f.context.newPage(); await missing.goto(missingUrl);
  await missing.getByRole('status').filter({hasText: "couldn't find the saved passage"}).waitFor({timeout: 12000});
  assert.equal(await missing.evaluate(() => CSS.highlights?.has('cuewoven-passage') || false), false);
  report.checks.push({name: 'removed exact sentence reports unavailable instead of highlighting partial words', passed: true});
  await missing.close();
  report.passed = true;
  assert.deepEqual(report.errors, []);
  console.log('ARTICLE_JUMP_PASS', JSON.stringify(report));
 } finally {
  if (process.env.RECALL_REPORT_DIR) fs.writeFileSync(path.join(process.env.RECALL_REPORT_DIR, 'cuewoven-article-jump.json'), JSON.stringify(report, null, 2));
  await f.close();
 }
})().catch(error => {console.error(error); process.exitCode = 1;});
