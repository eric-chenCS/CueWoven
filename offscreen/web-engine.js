import {matchesSource} from '../lib/search-intent.js';
import {createRevisionCache} from '../lib/revision-cache.js';
import { cleanItem, pagePassages, quantize, packedDot, webHitBuilder, policy, WEB_PASSAGES } from "../lib/web-items.js";
import { prepareQuery, normalizedPassage, createPool, addPassage, rankPool } from "../lib/search.js";
export function createWebEngine({ db, embed, onChange = () => {
} }) {
  let epoch = 0;
  const updates = new Map();
  const metadataCache = createRevisionCache(async () => {
    const records = new Map((await db.listVideos()).filter(row => policy.webId(row.videoId)).map(row => [row.videoId, row]));
    for (const [id, row] of updates) records.set(id, row);
    return records;
  });
  const cache = () => metadataCache.get();
  const remember = row => { updates.set(row.videoId, row); metadataCache.update(records => records.set(row.videoId, row)); };
  async function pack(rows, existing = []) {
    const reusable = new Map(existing.filter((row) => row.vec?.length === 384).map((row) => [row.text, row]));
    const missing = [...new Set(rows.filter((row) => !reusable.has(row.text)).map((row) => row.text))];
    if (missing.length) {
      const vectors = await embed(missing);
      missing.forEach((text, i) => reusable.set(text, quantize(vectors[i])));
    }
    return rows.map((row) => normalizedPassage({ ...row, vec: reusable.get(row.text).vec, scale: reusable.get(row.text).scale }));
  }
  async function save(input, rows, { replaceSource, replaceRange, imported = false, restore = false, pageFingerprint, indexedAt } = {}) {
    const started = epoch, video = await cleanItem({ ...input, watchedAt: input.watchedAt || Date.now() }), title = { start: 0, text: video.title, source: video.kind === "search" ? "Search" : "Title" };
    const previous = restore ? null : await db.items.get(video.videoId);
    const sanitized=rows.map(row=>({...row,text:policy.redactText(row.text),...(row.anchor?{anchor:policy.redactText(row.anchor)}:{})}));
    const packed = await pack([title, ...sanitized].slice(0, WEB_PASSAGES), previous?.passages);
    if (started !== epoch) return { disabled: true };
    const result = await db.items.put({ ...video, ...indexedAt ? { indexedAt } : {} }, packed, { replaceSource, replaceRange, imported, restore, pageFingerprint });
    remember(result.video);
    onChange();
    return result;
  }
  return {
    cancel() {
      epoch++;
    },
    metadata: cache,
    async refresh(id) {
      const row = await db.getVideo(id);
      if (row) remember(row);
    },
    reset() { metadataCache.invalidate(); updates.clear(); epoch++; },
    async ensure(video) {
      const existing = await db.getVideo(video.videoId);
      if (existing?.kind === "video") return existing;
      return (await save({ ...video, kind: "video" }, [], {})).video;
    },
    async importItems(items) {
      const started = epoch;
      if (!Array.isArray(items) || !items.length || items.length > 32) throw Error("Import 1–32 history items at a time.");
      const valid = await Promise.all(items.map(cleanItem));
      let imported = 0, skipped = 0;
      const pending = [];
      for (const video of valid) {
        if (started !== epoch) throw Error("History import stopped for a library change. Saved items remain; re-import to continue.");
        const old = await db.getVideo(video.videoId);
        if (old && old.watchedAt >= video.watchedAt) {
          skipped++;
          continue;
        }
        pending.push(video);
      }
      const titles = await pack(pending.map((video) => ({ text: video.title, start: 0, source: video.kind === "search" ? "Search" : "Title" })));
      try {
        for (const [i, video] of pending.entries()) {
          if (started !== epoch) throw Error("History import stopped for a library change. Re-import to continue.");
          const result = await db.items.put(video, [titles[i]], { imported: true });
          remember(result.video);
          imported++;
        }
      } finally {
        if (imported) onChange();
      }
      return { imported, skipped };
    },
    async capture(input) {
      const started = epoch, video = await cleanItem({ ...input, watchedAt: Date.now() }), hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(video.title + "|" + String(input.text || ""))), pageFingerprint = Array.from(new Uint8Array(hash)).join(","), old = await db.items.get(video.videoId);
      if (started !== epoch) return { disabled: true };
      if (old?.pageFingerprint === pageFingerprint && (!input.text || old.passages.some((row) => row.source === "Page text"))) {
        await db.touchWatch(video.videoId, Date.now());
        remember(await db.getVideo(video.videoId));
        onChange();
        return { ok: true, unchanged: true };
      }
      return save(video, pagePassages(input.text), { replaceSource: "Page text", pageFingerprint });
    },
    async imageCaption(video,caption){
      if(!caption)return;
      return save(video,[{start:0,text:caption,anchor:caption.slice(0,500),source:'Image caption'}],{});
    },
    async media(video, segments, source, replaceRange) {
      if (!["Transcript", "Audio"].includes(source) || !Array.isArray(segments) || segments.length > 160) throw Error("Invalid played-video transcript.");
      const rows = segments.filter((row) => Number.isFinite(row.start) && row.start >= 0 && row.start <= 86400 * 30 && typeof row.text === "string" && row.text.trim()).map((row) => ({ start: row.start, text: policy.redactText(row.text).trim().slice(0, 2e3), source, ...replaceRange ? { speechStart: replaceRange[0], speechEnd: replaceRange[1] } : {} }));
      if (!rows.length) return { ok: true, empty: true };
      return save({ ...video, kind: "video", watchedAt: Date.now() }, rows, { replaceRange });
    },
    async restore(input) {
      const valid = await cleanItem(input), rows = Array.isArray(input.passages) ? input.passages : [];
      if (rows.length > WEB_PASSAGES) throw Error("Too many saved page passages.");
      const sources = new Set(["Page text", "Transcript", "Audio","Image caption"]);
      for (const row of rows) if (!row || !sources.has(row.source) || typeof row.text !== "string" || row.text.length > 4e3 || !Number.isFinite(row.start) || row.start < 0 || row.start > 86400 * 30 || row.anchor !== void 0 && (typeof row.anchor !== "string" || row.anchor.length > 500)) throw Error("Invalid saved page passage.");
      for (const row of rows) if (row.speechStart !== void 0 || row.speechEnd !== void 0) {
        if (!Number.isFinite(row.speechStart) || !Number.isFinite(row.speechEnd) || row.speechStart < 0 || row.speechEnd <= row.speechStart || row.speechEnd - row.speechStart > 180) throw Error("Invalid saved audio range.");
      }
      const date = Number(input.indexedAt);
      return save(valid, rows, { restore: true, imported: input.historyImported === true, indexedAt: Number.isFinite(date) && date > 0 && date <= Date.now() + 6e4 ? date : Date.now() });
    },
    // Add every saved website passage to a shared ranking pool (see lib/search.js). Passages of
    // filtered-out items still count toward word frequencies, like the YouTube index.
    async collect(pool, vector, { sinceMs = 0, kind = "all", videoId, source } = {}) {
      const records = await cache();
      await db.items.searchScan((item) => {
        const video = records.get(item.id);
        const eligible = video && matchesSource(video,source) && !(videoId && video.videoId !== videoId) && !(kind !== "all" && video.kind !== kind) && !(sinceMs && (video.watchedAt || video.indexedAt || 0) < sinceMs);
        for (const row of item.passages) addPassage(pool, row, eligible ? video : null, eligible ? packedDot(vector, row) : NaN, eligible ? webHitBuilder(video, row) : null, 0);
      });
      return pool;
    },
    async search(query, vector, { sinceMs = 0, kind = "all", videoId, perVideo = 2, limit = 2048, prepared = prepareQuery(query) } = {}) {
      const pool = createPool(prepared);
      await this.collect(pool, vector, { sinceMs, kind, videoId });
      return rankPool(pool, { perVideo, limit });
    }
  };
}
