const fixture = require("./web-fixture.cjs"), assert = require("assert/strict"), path = require("path");
(async () => {
  const f = await fixture();
  try {
    await f.context.route("https://www.example.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Public coral article</title><article>Coral bleaching happens when warming oceans drive away the algae that feed the reef. Keeping water cooler allows coral communities to recover.</article>" }));
    await f.enable();
    const article = await f.context.newPage();
    await article.goto("https://www.example.com/article");
    await f.wait(async () => (await f.send({ type: "list" })).videos.some((row) => row.kind === "page" && row.chunkCount > 0));
    const tab = await f.options.evaluate(async () => (await chrome.tabs.query({})).find((tab2) => tab2.url === "https://www.example.com/article"));
    const popup = await f.context.newPage();
    await popup.addInitScript((tab2) => {
      const original = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = async (options) => options.active ? [tab2] : original(options);
    }, tab);
    await popup.goto(f.base + "/popup/popup.html");
    await popup.waitForFunction(() => document.querySelector("#page-capture-status").textContent.includes("Saved"));
    assert.equal(await popup.locator("#index-now").isVisible(), false, "article uses Save page rather than duplicate video controls");
    await article.bringToFront();
    await popup.evaluate(() => document.querySelector("#page-save-now").click());
    await popup.waitForFunction(() => document.querySelector("#page-capture-status").textContent.includes("Saved"));
    await f.options.locator("#sec-diagnostics > summary").click();
    await f.options.locator("#diagnostics-refresh").click();
    await f.options.waitForFunction(() => document.querySelector("#storage-usage").textContent.includes("Protected"));
    const log = await f.options.evaluate(async () => (await chrome.storage.session.get("captureLog")).captureLog);
    assert.ok(log.some((row) => row.host === "www.example.com"));
    assert.ok(log.every((row) => Object.keys(row).every((key) => ["time", "host", "kind", "reason", "outcome"].includes(key))));
    const storage = await f.options.evaluate(async () => ({ estimate: await navigator.storage.estimate(), permission: await chrome.permissions.contains({ permissions: ["unlimitedStorage"] }) }));
    assert.equal(storage.permission, true);
    assert.ok(storage.estimate.quota > 0);
    await popup.evaluate(() => document.querySelector("#page-forget").click());
    await f.wait(async () => !(await f.send({ type: "list" })).videos.some((row) => row.url === "https://www.example.com/article"));
    const blocked = await f.options.evaluate(async () => (await chrome.storage.local.get("webCapture")).webCapture.blocked);
    assert.ok(blocked.includes("www.example.com"));
    await f.send({ type: "web-import", items: [{ kind: "page", url: "https://old.example.com/article", title: "Old imported article", watchedAt: Date.now() - 400 * 864e5 }, { kind: "page", url: "https://recent.example.com/article", title: "Recent imported article", watchedAt: Date.now() - 10 * 864e5 }] });
    await f.options.locator("#maxAgeDays").selectOption("0");
    await f.options.locator("#importMaxAgeDays").selectOption("28");
    await f.wait(async () => {
      const rows = (await f.send({ type: "list" })).videos;
      return rows.some((row) => row.title === "Recent imported article") && !rows.some((row) => row.title === "Old imported article");
    });
    if (process.env.RECALL_SCREENSHOT_DIR) {
      await f.options.screenshot({ path: path.join(process.env.RECALL_SCREENSHOT_DIR, "recall-v3-diagnostics.png"), fullPage: true });
      await popup.screenshot({ path: path.join(process.env.RECALL_SCREENSHOT_DIR, "recall-v3-page-status.png"), fullPage: true });
    }
    await f.options.locator("#diagnostics-clear").click();
    assert.equal((await f.options.evaluate(async () => (await chrome.storage.session.get("captureLog")).captureLog || [])).length, 0);
    console.log("DIAGNOSTICS_PASS", JSON.stringify({ logEvents: log.length, protectedStorage: storage.permission, quota: storage.estimate.quota, popupSaveAndForget: true, originalDateImportRetention: true }));
  } finally {
    await f.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
