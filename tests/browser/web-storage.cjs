const fixture = require("./web-fixture.cjs"), assert = require("assert/strict"), fs = require("fs"), path = require("path");
(async () => {
  const f = await fixture();
  try {
    const caps = await f.options.evaluate(async () => {
      const db = await import(chrome.runtime.getURL("lib/db.js")), W = await import(chrome.runtime.getURL("lib/web-items.js")),{normalizedPassage}=await import(chrome.runtime.getURL('lib/search.js'));
      await db.clearAll();
      const vec = new Int8Array(384), row = (source, text, start = 0) => normalizedPassage({ source, text, start, vec, scale: 1 }), entries = [];
      let bytes = 0;
      for (let i = 0; i < 2e3; i++) {
        const identity2 = await W.itemIdentity("https://example.com/item/" + i), title = i === 1999 ? "Coral bleaching final record" : "Generic browsing item " + i, video2 = { ...identity2, kind: "page", title, channel: "example.com", watchedAt: Date.now(), indexedAt: Date.now(), method: "web-content", chunkCount: 1, historyImported: true };
        const passages = [row("Title", title), row("Page text", "A short saved paragraph about ordinary browsing.")];
        bytes += (passages[1].text.length+passages[1].lexicalText.length) * 2 + 384 + 128;
        entries.push({ video: video2, item: { id: video2.videoId, contentAt: i + 1, passages } });
      }
      const database = await new Promise((resolve, reject) => {
        const req = indexedDB.open("recall", 5);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = database.transaction(["videos", "items"], "readwrite");
      for (const entry of entries) {
        tx.objectStore("videos").put(entry.video);
        tx.objectStore("items").put(entry.item);
      }
      tx.objectStore("items").put({ id: "@stats", bytes, count: 2e3 });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      database.close();
      const identity = await W.itemIdentity("https://example.com/new"), video = { ...identity, kind: "page", title: "Fresh page", watchedAt: Date.now() };
      await db.items.put(video, [row("Title", "Fresh page"), row("Page text", "Fresh saved paragraph.")]);
      const oldest = await db.items.get(entries[0].video.videoId), stats = await db.items.get("@stats");
      if (oldest.passages.length !== 1 || oldest.passages[0].source !== "Title" || stats.count !== 2e3) throw Error("Full-item cap did not retain titles.");
      await db.deleteVideo(video.videoId);
      const deleted = await db.items.get("@stats");
      if (deleted.count !== 1999) throw Error("Delete did not update the content budget.");
      return { fullItems: stats.count, titleRowsAfterEviction: oldest.passages.length, afterDelete: deleted.count, target: entries[1999].video.videoId, vectorBytes: 2e3 * 384, float32Bytes: 2e3 * 384 * 4 };
    });
    const timings = [];
    let found;
    await f.send({ type: "warmup" });
    for (let i = 0; i < 3; i++) {
      const start = Date.now(), result = await f.send({ type: "search", query: '"Coral bleaching final record"', kind: "page" });
      timings.push(Date.now() - start);
      assert.equal(result.results[0].videoId, caps.target);
      found = result.results[0].title;
    }
    await f.send({ type: "clear" });
    const fullPages=await f.options.evaluate(async()=>{
      const db=await import(chrome.runtime.getURL('lib/db.js')),W=await import(chrome.runtime.getURL('lib/web-items.js')),{normalizedPassage}=await import(chrome.runtime.getURL('lib/search.js'));
      const vocabulary='ocean science coral reefs algae sunlight water chemistry climate marine biology'.split(' '),text=Array.from({length:2000},(_,i)=>vocabulary[i%vocabulary.length]).join(' '),vec=new Int8Array(384);
      let target,passages=0;
      for(let i=0;i<600;i++){
        const identity=await W.itemIdentity('https://example.com/full-page/'+i),title=i===599?'Cobalt telescope final full page':'Marine science page '+i,rows=[{source:'Title',text:title,start:0,vec,scale:1},...W.pagePassages(text).map(row=>({...row,vec,scale:1}))].map(normalizedPassage);
        await db.items.put({...identity,kind:'page',title,watchedAt:Date.now()},rows,{imported:true});
        passages+=rows.length-1;if(i===599)target=identity.videoId;
      }
      return {items:600,passages,wordsPerPage:2000,stats:await db.items.get('@stats'),target};
    });
    const fullQueryMs=[];
    for(let i=0;i<3;i++){
      const start=Date.now(),result=await f.send({type:'search',query:'"Cobalt telescope final full page"',kind:'page'});
      fullQueryMs.push(Date.now()-start);assert.equal(result.results[0].videoId,fullPages.target);
    }
    assert.equal(fullPages.stats.count,600);assert.ok(fullPages.stats.bytes<=64*1024*1024);
    await f.send({type:'clear'});
    const budget = await f.options.evaluate(async () => {
      const db = await import(chrome.runtime.getURL("lib/db.js")), W = await import(chrome.runtime.getURL("lib/web-items.js")), vec = new Int8Array(384);
      let final;
      for (let i = 0; i < 100; i++) {
        const identity = await W.itemIdentity("https://example.com/long-video/" + i), title = "Long played video " + i, video = { ...identity, kind: "video", title, watchedAt: Date.now() }, passages = [{ source: "Title", text: title, start: 0, vec, scale: 1 }, ...Array.from({ length: 159 }, (_, j) => ({ source: "Transcript", text: ("Spoken line " + j + " ").padEnd(2e3, "a"), start: j * 15, vec, scale: 1 }))];
        await db.items.put(video, passages);
        final = await db.items.get("@stats");
      }
      if (final.bytes > W.WEB_BYTES || final.count >= 100) throw Error("Byte budget did not evict older full text.");
      let count = 0, titles = 0;
      await db.items.scan((item) => {
        count++;
        if (item.passages.length === 1 && item.passages[0].source === "Title") titles++;
      });
      return { bytes: final.bytes, limit: W.WEB_BYTES, fullItems: final.count, totalItems: count, titleOnly: titles };
    });
    assert.equal(budget.totalItems, 100);
    assert.ok(budget.titleOnly > 0);
    const report = { caps, budget, queryMs: timings, fullPages,fullQueryMs,found, scope: "Synthetic zero-vector rows: 2,000 short items plus 600 full 2,000-word pages. Real IndexedDB scan, lexical ranking and MiniLM query; excludes cold model load. Byte budget uses 100 long transcripts. No user history." };
    console.log("WEB_STORAGE_PASS", JSON.stringify(report));
    if (process.env.RECALL_SCREENSHOT_DIR) fs.writeFileSync(path.join(process.env.RECALL_SCREENSHOT_DIR, "recall-v3-web-storage.json"), JSON.stringify(report, null, 2) + "\n");
  } finally {
    await f.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
