const fixture = require("./web-fixture.cjs"), assert = require("assert/strict");
(async () => {
  const f = await fixture();
  try {
    await f.send({ type: "status" });
    await f.options.goto("about:blank");
    await f.worker.evaluate(async () => {
      await chrome.offscreen.closeDocument();
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase("recall");
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const request = indexedDB.open("recall", 4);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore("videos", { keyPath: "videoId" });
          db.createObjectStore("chunks", { keyPath: "id", autoIncrement: true }).createIndex("videoId", "videoId");
          const scenes = db.createObjectStore("scenes", { keyPath: "key" });
          scenes.createIndex("videoId", "videoId");
          scenes.createIndex("indexedAt", "indexedAt");
          const screen = db.createObjectStore("screenText", { keyPath: "key" });
          screen.createIndex("videoId", "videoId");
          screen.createIndex("indexedAt", "indexedAt");
          screen.createIndex("videoTime", ["videoId", "indexedAt"]);
          db.createObjectStore("items", { keyPath: "id" }).createIndex("contentAt", "contentAt");
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result, tx = db.transaction(["videos", "chunks", "screenText", "items"], "readwrite"), vec = new Int8Array(384);
          tx.objectStore("videos").put({ videoId: "aaaaaaaaaaa", title: "Legacy captions", watchedAt: 17e11, indexedAt: 17e11, historyImported: true, method: "captions" });
          tx.objectStore("chunks").put({ videoId: "aaaaaaaaaaa", start: 42, text: "Café coral science.", vec: new Float32Array(384) });
          tx.objectStore("screenText").put({ key: "aaaaaaaaaaa:1", videoId: "aaaaaaaaaaa", start: 45, text: "Café on screen.", vec: new Float32Array(384), indexedAt: 17e11 });
          for (let i = 0; i < 100; i++) {
            const id = "web_" + i.toString(16).padStart(64, "0"), passages = [{ source: "Title", text: "Saved page " + i, start: 0, vec, scale: 1 }, ...Array.from({ length: 159 }, (_, j) => ({ source: "Page text", text: ("Café ocean science " + j + " ").padEnd(1e3, "a"), start: j * 140, vec, scale: 1 }))];
            tx.objectStore("videos").put({ videoId: id, kind: "page", url: "https://example.com/" + i, title: "Saved page " + i, historyImported: true, watchedAt: 17e11, indexedAt: 17e11, method: "web-content", chunkCount: 159 });
            tx.objectStore("items").put({ id, passages, contentAt: i + 1, pageFingerprint: "preserved" });
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    });
    await f.options.goto(f.base + "/options/options.html");
    const result = await f.options.evaluate(async () => {
      const db = await import(chrome.runtime.getURL("lib/db.js")), stats = await db.items.get("@stats"), records = await db.listVideos(), chunks = await db.chunksOf("aaaaaaaaaaa"), screen = await db.screenText.all();
      let titleOnly = 0, rows = 0, missing = 0, oldest;
      await db.items.scan((item) => {
        rows++;
        if (item.passages.length === 1) titleOnly++;
        for (const row of item.passages) if (typeof row.lexicalText !== "string") missing++;
        if (item.id === "web_" + "0".repeat(64)) oldest = item;
      });
      return { stats, records: records.length, rows, titleOnly, missing, oldestFull: oldest.passages.length, caption: chunks[0].lexicalText, captionTime: chunks[0].start, screen: screen[0].lexicalText, datesPreserved: records.every((row) => row.watchedAt === 17e11 && row.historyImported === true) };
    });
    assert.equal(result.records, 101);
    assert.equal(result.rows, 100);
    assert.equal(result.missing, 0);
    assert.equal(result.caption, "cafe coral science");
    assert.equal(result.captionTime, 42);
    assert.equal(result.screen, "cafe on screen");
    assert.equal(result.datesPreserved, true);
    assert.ok(result.stats.bytes <= 64 * 1024 * 1024);
    assert.ok(result.titleOnly > 0);
    assert.equal(result.oldestFull, 1);
    console.log("WEB_MIGRATION_PASS", JSON.stringify(result));
  } finally {
    await f.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
