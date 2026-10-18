const fixture = require("./web-fixture.cjs"), assert = require("assert/strict"), fs = require("fs"), path = require("path");
(async () => {
  const f = await fixture();
  try {
    await f.send({ type: "clear" });
    const seed = await f.options.evaluate(async () => {
      const { normalizedPassage } = await import(chrome.runtime.getURL("lib/search.js")), db = await import(chrome.runtime.getURL("lib/db.js")), W = await import(chrome.runtime.getURL("lib/web-items.js"));
      const database = await new Promise((resolve, reject) => {
        const req = indexedDB.open("recall", 6);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }), vec = new Int8Array(384);
      const tx = database.transaction(["videos", "items", "titles"], "readwrite"), bundles = Array.from({length:64},(_,id)=>({id:String(id),items:[]}));
      for (let i = 0; i < 5e4; i++) {
        const id = "web_" + i.toString(16).padStart(64, "0"), title = "Ocean science source " + i;
        tx.objectStore("videos").put({ videoId: id, itemId: id, kind: "page", title, channel: "example.com", url: "https://example.com/history/" + i, watchedAt: 17e11, indexedAt: 17e11, historyImported: true, method: "web-title", chunkCount: 0 });
        const item={id,contentAt:0,passages:[normalizedPassage({source:"Title",start:0,text:title,vec,scale:1})]};
        tx.objectStore("items").put(item);bundles[i%64].items.push({id,passages:item.passages});
      }
      for(const bundle of bundles)tx.objectStore("titles").put(bundle);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      database.close();
      const text = Array.from({ length: 2e3 }, (_, i) => "ocean science coral reefs algae sunlight water chemistry climate marine biology".split(" ")[i % 11]).join(" ");
      for (let i = 0; i < 600; i++) {
        const identity = await W.itemIdentity("https://example.com/full/" + i), title = "Full ocean science source " + i;
        await db.items.put({ ...identity, kind: "page", title, watchedAt: 17e11 }, [{ source: "Title", start: 0, text: title, vec, scale: 1 }, ...W.pagePassages(text).map((row) => ({ ...row, vec, scale: 1 }))], { imported: true });
      }
      return { titles: 5e4, fullPages: 600, stats: await db.items.get("@stats") };
    });
    await f.send({ type: "warmup" });
    const searchMs = [], arrowMs = [];
    for (const query of ["science", "ocean", "source", '"Ocean science"', "SCIENCE", "OCEAN", "SOURCE", '"ocean science"']) {
      const start = performance.now(), result = await f.send({ type: "search", query, kind: "page", singleVideo: true, offset: 0 });
      searchMs.push(performance.now() - start);
      assert.ok(result.results?.length, result.error);
      for (const offset of [1, 2, 3]) {
        const t = performance.now(), page = await f.send({ type: "search", query, kind: "page", singleVideo: true, offset });
        arrowMs.push(performance.now() - t);
        assert.ok(page.results?.length, page.error);
      }
    }
    const percentile = (rows, p) => [...rows].sort((a, b) => a - b)[Math.min(rows.length - 1, Math.ceil(rows.length * p) - 1)];
    const report = { ...seed, searchMs, arrowMs, medianMs: percentile(searchMs, 0.5), p95Ms: percentile(searchMs, 0.95), arrowP95Ms: percentile(arrowMs, 0.95), scope: "50,000 synthetic titles plus 600 full 2,000-word pages; real IndexedDB and MiniLM query; synthetic zero saved vectors; no user history. Cold runtime/model load excluded." };
    console.log("WEB_LARGE_RESULT", JSON.stringify(report));
    if (process.env.RECALL_SCREENSHOT_DIR) fs.writeFileSync(path.join(process.env.RECALL_SCREENSHOT_DIR, "recall-v3-large-search.json"), JSON.stringify(report, null, 2));
    const key = { type: "search", query: '"ocean science"', kind: "page", singleVideo: true, offset: 0 }, before = await f.send(key), removed = before.results[0].videoId;
    await f.send({ type: "delete", videoId: removed });
    assert.ok((await f.send(key)).results.every((row) => row.videoId !== removed), "deleted result is absent from the cached query");
    const exact = { ...key, query: '"Unique cobalt demonstration"' };
    assert.equal((await f.send(exact)).results.length, 0);
    await f.send({ type: "web-import", items: [{ kind: "page", url: "https://example.com/new-cached-query", title: "Unique cobalt demonstration", watchedAt: Date.now() }] });
    assert.equal((await f.send(exact)).results[0].title, "Unique cobalt demonstration", "new import invalidates an empty query cache");
    if (process.env.RECALL_PERF_CHECK !== "0") {
      assert.ok(report.p95Ms < Number(process.env.RECALL_SEARCH_BUDGET_MS || 1e3), "new-query p95 exceeded the calibrated 1-second budget");
      assert.ok(report.arrowP95Ms < Number(process.env.RECALL_ARROW_BUDGET_MS || 50), "arrow p95 exceeded budget");
    }
  } finally {
    await f.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
