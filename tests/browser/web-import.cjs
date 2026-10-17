const fixture = require("./web-fixture.cjs"), assert = require("assert/strict");
(async () => {
  const f = await fixture();
  try {
    await f.send({ type: "warmup" });
    await f.options.evaluate(async () => {
      const { libraryBusy } = await import(chrome.runtime.getURL("lib/library-busy.js")), original = chrome.runtime.sendMessage.bind(chrome.runtime);
      window.__listsDuringImport = 0;
      window.__totalLists = 0;
      chrome.runtime.sendMessage = async (msg) => {
        if (msg.type === "list") {
          window.__totalLists++;
          if (libraryBusy()) window.__listsDuringImport++;
        }
        const response = await original(msg);
        if (msg.type === "web-import") await new Promise((resolve) => setTimeout(resolve, 750));
        return response;
      };
    });
    const data = { "Browser History": Array.from({ length: 33 }, (_, i) => ({ url: "https://example.com/article/" + i, title: "Science title " + i, time_usec: 17e14 })) };
    await f.options.locator("#web-history-file").setInputFiles({ name: "BrowserHistory.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)) });
    await f.options.waitForFunction(() => document.querySelector("#web-import-msg").textContent.startsWith("Done:"));
    await f.options.waitForTimeout(800);
    const result = await f.options.evaluate(() => ({ during: window.__listsDuringImport, total: window.__totalLists, rows: document.querySelectorAll(".vid").length }));
    assert.equal(result.during, 0);
    assert.ok(result.total <= 2);
    assert.equal(result.rows, 33);
    console.log("WEB_IMPORT_PASS", JSON.stringify(result));
  } finally {
    await f.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
