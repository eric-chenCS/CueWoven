import { WEB_BYTES, WEB_FULL_ITEMS, WEB_PASSAGES } from "./web-items.js";
import { normalizedPassage } from "./search.js";
const titleOnly = (row) => ["Title", "Search"].includes(row.source);
const bytes = (rows) => rows.filter((row) => !titleOnly(row)).reduce((sum, row) => sum + (row.text.length + (row.anchor?.length || 0) + (row.lexicalText?.length || 0)) * 2 + row.vec.byteLength + 128, 0);
async function enforceBudget(tx, stats, keepId) {
  const items = tx.objectStore("items"), videos = tx.objectStore("videos");
  if (stats.bytes > WEB_BYTES || stats.count > WEB_FULL_ITEMS) {
    await new Promise((resolve, reject) => {
      const req = items.index("contentAt").openCursor(IDBKeyRange.lowerBound(1));
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor || stats.bytes <= WEB_BYTES && stats.count <= WEB_FULL_ITEMS) return resolve();
        const row = cursor.value;
        if (row.id !== keepId) {
          stats.bytes -= bytes(row.passages);
          stats.count--;
          cursor.update({ ...row, passages: row.passages.filter(titleOnly), contentAt: 0, pageFingerprint: void 0 });
          const meta = videos.get(row.id);
          meta.onsuccess = () => {
            if (meta.result) videos.put({ ...meta.result, method: "web-title", chunkCount: 0 });
          };
        }
        cursor.continue();
      };
    });
  }
}
export async function upgradeWebItems(tx) {
  const items = tx.objectStore("items"), stats = { id: "@stats", bytes: 0, count: 0 };
  await new Promise((resolve, reject) => {
    const request = items.openCursor();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve();
      const row = cursor.value;
      if (row.id !== "@stats") {
        const passages = row.passages.map(normalizedPassage), size = bytes(passages);
        stats.bytes += size;
        stats.count += Number(size > 0);
        cursor.update({ ...row, passages });
      }
      cursor.continue();
    };
  });
  await enforceBudget(tx, stats);
  items.put(stats);
}
export function itemStorage(open, result, done) {
  async function removeRows(store, id) {
    const keys = await result(store.index("videoId").getAllKeys(id));
    for (const key of keys) store.delete(key);
  }
  return {
    async get(id) {
      const db = await open();
      return result(db.transaction("items").objectStore("items").get(id));
    },
    async scan(visit) {
      const db = await open();
      let after = null;
      while (true) {
        const batch = await result(db.transaction("items").objectStore("items").getAll(after ? IDBKeyRange.lowerBound(after, true) : null, 500));
        if (!batch.length) break;
        for (const row of batch) if (row.id !== "@stats") visit(row);
        after = batch.at(-1).id;
      }
    },
    async put(video, incoming, { replaceSource, replaceRange, imported = false, restore = false, pageFingerprint } = {}) {
      const db = await open(), tx = db.transaction(["videos", "items"], "readwrite"), complete = done(tx), items = tx.objectStore("items"), videos = tx.objectStore("videos");
      const old = await result(items.get(video.videoId)), existing = await result(videos.get(video.videoId)), stats = await result(items.get("@stats")) || { id: "@stats", bytes: 0, count: 0 };
      let passages = restore ? incoming : [...(old?.passages || []).filter((row) => !titleOnly(row) && row.source !== replaceSource && !(replaceRange && row.source === "Audio" && (row.speechStart ?? row.start) < replaceRange[1] && (row.speechEnd ?? row.start + 30) > replaceRange[0])), ...incoming];
      const seen = new Set();
      passages = passages.filter((row) => {
        const key = row.source + ":" + row.start + ":" + row.text;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const title = passages.filter(titleOnly).slice(-1);
      passages = [...title, ...passages.filter((row) => !titleOnly(row)).slice(-(WEB_PASSAGES - 1))].map((row) => typeof row.lexicalText === "string" ? row : normalizedPassage(row));
      const size = bytes(passages), previous = bytes(old?.passages || []);
      stats.bytes += size - previous;
      stats.count += Number(size > 0) - Number(previous > 0);
      const record = { ...existing, ...video, kind: existing?.kind === "video" ? "video" : video.kind, indexedAt: restore ? video.indexedAt || Date.now() : imported ? existing?.indexedAt || Date.now() : Date.now(), watchedAt: Math.max(existing?.watchedAt || 0, video.watchedAt || 0), historyImported: imported ? existing?.historyImported ?? true : false, chunkCount: passages.filter((row) => !titleOnly(row)).length, method: size ? "web-content" : "web-title" };
      items.put({ id: video.videoId, passages, contentAt: size ? Date.now() : 0, pageFingerprint: restore ? void 0 : pageFingerprint ?? old?.pageFingerprint });
      videos.put(record);
      await enforceBudget(tx, stats, video.videoId);
      items.put(stats);
      await complete;
      return { ok: true, video: record, chunkCount: record.chunkCount };
    },
    async delete(id) {
      const db = await open(), tx = db.transaction(["videos", "items", "scenes", "screenText"], "readwrite"), complete = done(tx), items = tx.objectStore("items"), old = await result(items.get(id)), stats = await result(items.get("@stats"));
      if (stats && old) {
        const size = bytes(old.passages);
        items.put({ ...stats, bytes: Math.max(0, stats.bytes - size), count: Math.max(0, stats.count - Number(size > 0)) });
      }
      items.delete(id);
      tx.objectStore("videos").delete(id);
      await removeRows(tx.objectStore("scenes"), id);
      await removeRows(tx.objectStore("screenText"), id);
      await complete;
    }
  };
}
