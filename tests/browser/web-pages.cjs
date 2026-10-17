const fixture = require("./web-fixture.cjs"), assert = require("assert/strict"), fs = require("fs"), path = require("path");
(async () => {
  const f = await fixture(), { context, options, base, send, wait, enable } = f, errors = [];
  context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
  try {
    await context.route("https://*.example.com/**", (route) => {
      const url = new URL(route.request().url()), privatePage2 = url.pathname === "/password";
      return route.fulfill({ contentType: "text/html", body: `<!doctype html><title>${privatePage2 ? "Private sample" : "Coral reef science"}</title><article>Short unrelated teaser.</article><article><h1>Coral reefs</h1><p id="body">Coral bleaching occurs when warm ocean water drives away symbiotic algae. The loss of these algae turns the coral white and deprives it of food. Restoring cooler water helps the reef recover.</p><p style="display:none">HIDDEN_SECRET_BODY</p><form><p>FORM_SECRET_BODY</p><input value="FORM_SECRET_VALUE" />${privatePage2 ? '<input type="password" value="PASSWORD_SECRET" />' : '<div style="display:none"><input type="password" value="HIDDEN_PASSWORD_SECRET" /></div>'}</form><div contenteditable="true" style="width:200px;height:40px">COMMENT_SECRET_BODY</div></article>` });
    });
    const chromeHistory = { "Browser History": [{ url: "https://articles.example.com/reef", title: "Coral reef science", time_usec: 17e14 }, { url: "https://bank.example.com/account", title: "PRIVATE_BANK_TITLE", time_usec: 17e14 }, { url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", title: "A YouTube video", time_usec: 17e14 }] };
    await options.locator("#web-history-file").setInputFiles({ name: "BrowserHistory.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(chromeHistory)) });
    await options.waitForFunction(() => document.querySelector("#web-import-msg").textContent.startsWith("Done:"));
    assert.equal((await send({ type: "list" })).videos.find((row) => row.videoId === "aaaaaaaaaaa")?.title, "A YouTube video");
    const searches = [{ title: "Has buscado coral bleaching", titleUrl: "https://www.google.com/search?q=coral+bleaching", time: "2020-01-01T12:00:00Z" }];
    await options.locator("#web-history-file").setInputFiles({ name: "MyActivity.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(searches)) });
    await wait(async () => (await send({ type: "list" })).videos.some((row) => row.kind === "search"));
    assert.equal((await send({ type: "search", query: "coral reef science", kind: "page" })).results[0].matchSources[0], "Title");
    assert.equal((await send({ type: "search", query: "coral bleaching", kind: "search" })).results[0].matchSources[0], "Search");
    const page = await context.newPage();
    await page.goto("https://articles.example.com/reef");
    await page.waitForTimeout(6e3);
    assert.equal((await send({ type: "list" })).videos.find((row) => row.kind === "page").chunkCount, 0, "capture starts off even with test-pregranted permission");
    await enable();
    await page.reload();
    await wait(async () => (await send({ type: "list" })).videos.find((row) => row.kind === "page" && row.chunkCount > 0));
    const semantic = await send({ type: "search", query: "why corals turn white when the sea becomes too warm", kind: "page" });
    assert.equal(semantic.results[0].pageText, true);
    assert.equal(semantic.results[0].url, "https://articles.example.com/reef");
    let backup = await send({ type: "export" });
    assert.equal(backup.items.length, 2);
    assert.ok(backup.items.find((item) => item.kind === "page").passages.length);
    assert.ok(!JSON.stringify(backup).includes("SECRET"));
    assert.ok(!JSON.stringify(backup).includes("PRIVATE_BANK"));
    assert.ok(!JSON.stringify(backup).includes("unrelated teaser"), 'largest article is captured');
    await page.locator('#body').evaluate(node=>node.textContent+=' A newly added observation about coral recovery.');
    await page.waitForTimeout(11500);
    assert.ok(!JSON.stringify(await send({type:'export'})).includes('newly added observation'), 'small DOM changes do not save before the sixty-second cooldown');
    await page.evaluate(()=>{const editor=document.querySelector('[contenteditable]');editor.style.cssText='position:fixed;inset:0;width:100vw;height:100vh';});
    const editorContext=await options.evaluate(async()=>{const tabs=await chrome.tabs.query({});const tab=tabs.find(tab=>tab.url==='https://articles.example.com/reef');return chrome.tabs.sendMessage(tab.id,{type:'web-context'});});
    assert.equal(editorContext.private,true,'dominant editor still prevents page capture');
    await page.locator('[contenteditable]').evaluate(node=>node.style.cssText='width:200px;height:40px');
    const privatePage = await context.newPage();
    await privatePage.goto("https://articles.example.com/password");
    await privatePage.waitForTimeout(6500);
    assert.equal((await send({ type: "list" })).videos.some((row) => row.url?.includes("/password")), false);
    const popup = await context.newPage();
    await popup.goto(`${base}/popup/popup.html`);
    await popup.locator("#kind-filter").selectOption("page");
    await popup.locator("#q").fill("why corals turn white in warm seas");
    await wait(async () => await popup.locator(".result").count());
    const href = await popup.locator(".result").first().getAttribute("href");
    assert.match(href, /^https:\/\/articles\.example\.com\/reef#:~:text=/);
    assert.match(await popup.locator(".match-sources").first().textContent(), /Page text/);
    assert.match(await popup.locator(".result img").first().getAttribute("src"), /web\.svg/);
    if (process.env.RECALL_SCREENSHOT_DIR) {
      await popup.screenshot({ path: path.join(process.env.RECALL_SCREENSHOT_DIR, "recall-v3-web-light.png"), fullPage: true });
      await popup.emulateMedia({ colorScheme: "dark" });
      await popup.screenshot({ path: path.join(process.env.RECALL_SCREENSHOT_DIR, "recall-v3-web-dark.png"), fullPage: true });
    }
    await popup.locator("#kind-filter").selectOption("search");
    await popup.locator("#q").fill("coral bleaching");
    await wait(async () => await popup.locator(".result .match-sources").first().textContent().then((text) => text === "Search").catch(() => false));
    await send({ type: "clear" });
    const imported = await send({ type: "import", data: backup });
    assert.equal(imported.error, void 0);
    assert.equal((await send({ type: "export" })).items.length, 2);
    assert.equal((await send({ type: "search", query: "warm ocean water drives away symbiotic algae", kind: "page" })).results[0].pageText, true);
    const race = await options.evaluate(async () => {
      const capture = chrome.runtime.sendMessage({ target: "offscreen", type: "web-capture", kind: "page", url: "https://articles.example.com/race", title: "Canceled public article", watchedAt: Date.now(), text: "Public science article about coral and ocean temperature. ".repeat(500) });
      const clear = chrome.runtime.sendMessage({ type: "clear" });
      return { capture: await capture, clear: await clear, after: await chrome.runtime.sendMessage({ type: "list" }) };
    });
    assert.equal(race.clear.ok, true);
    assert.equal(race.after.videos.length, 0);
    await send({ type: "import", data: backup });
    await options.locator("#web-domain").fill("example.com");
    await options.locator("#web-forget").click();
    await options.waitForFunction(() => document.querySelector("#web-msg").textContent.startsWith("Forgot"));
    assert.equal((await send({ type: "list" })).videos.some((row) => row.url?.includes("example.com")), false);
    assert.equal((await send({ type: "web-import", items: [{ kind: "page", url: "https://articles.example.com/reef", title: "Coral reef science", watchedAt: Date.now() }] })).imported, 0);
    const layouts = [];
    for (const width of [320, 768, 1024, 1440]) {
      await options.setViewportSize({ width, height: 900 });
      layouts.push({ width, overflow: await options.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
    }
    assert.ok(layouts.every((row) => !row.overflow));
    assert.deepEqual(errors, []);
    console.log("WEB_PAGES_PASS", JSON.stringify({ sources: ["Chrome JSON", "Google Search JSON", "live article text"], semanticTop: semantic.results[0].title, fragment: href, privateAndFormExclusions: true, backup: true, captureClearRace: true, forgetAndBlock: true, layouts }));
  } finally {
    await f.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
