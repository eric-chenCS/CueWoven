const fixture = require("./web-fixture.cjs"), fs = require("fs"), path = require("path");
(async () => {
  const f = await fixture({ sites: ["wikipedia.org", "instagram.com", "tiktok.com"] }), report = { scope: "Isolated browser, public pages, no user cookies/history; no video/page mocks", pages: [] };
  try {
    await f.enable();
    for (const url of ["https://en.wikipedia.org/wiki/Coral_bleaching"]) {
      const page = await f.context.newPage(), entry = { url };
      report.pages.push(entry);
      try {
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 3e4 });
        entry.status = response?.status();
        await page.waitForTimeout(18e3);
        entry.title = await page.title();
        entry.videos = await page.locator("video").count();
        entry.pageState = await page.evaluate(() => ({ passwordField: !!document.querySelector('input[type="password"]'), text: document.body.innerText.slice(0, 250) }));
        if (entry.videos) {
          try {
            await page.locator("video").first().click({ timeout: 3e3 });
          } catch {
          }
          await page.waitForTimeout(8e3);
        }
        const saved = await f.send({ type: "list" });
        entry.model = await f.send({ type: "status" });
        const tabs = await f.worker.evaluate(() => chrome.tabs.query({}));
        const target = tabs.find((tab) => tab.url === page.url());
        if (target) {
          entry.captureState = await f.worker.evaluate(async (id) => {
            try {
              return await chrome.tabs.sendMessage(id, { type: "web-context" });
            } catch (error) {
              return { error: error.message };
            }
          }, target.id);
          entry.manual = await f.worker.evaluate(async (id) => {
            try {
              return await chrome.tabs.sendMessage(id, { type: "index-now" });
            } catch (error) {
              return { error: error.message };
            }
          }, target.id);
        }
        entry.saved = (await f.send({ type: "list" })).videos.filter((row) => row.url && new URL(row.url).hostname === new URL(url).hostname).map(({ kind, title, chunkCount, sceneCount, screenCount }) => ({ kind, title, chunkCount, sceneCount, screenCount }));
      } catch (error) {
        entry.error = error.message;
      }
      await page.close();
    }
  } finally {
    console.log("LIVE_WEB_REPORT", JSON.stringify(report));
    if (process.env.RECALL_SCREENSHOT_DIR) fs.writeFileSync(path.join(process.env.RECALL_SCREENSHOT_DIR, "recall-v3-live-web.json"), JSON.stringify(report, null, 2) + "\n");
    await f.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
