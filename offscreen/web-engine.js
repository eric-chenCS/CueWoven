import { cleanItem, pagePassages, quantize, webHit, policy, WEB_PASSAGES } from "../lib/web-items.js";
import { queryTerms } from "../lib/search.js";
export function createWebEngine({ db, embed, onChange = () => {
} }) {
  let metadata = null, loading = null, epoch = 0;
  const cache = async () => {
    if (metadata) return metadata;
    if (!loading) loading = db.listVideos().then((rows) => metadata = new Map(rows.filter((row) => policy.webId(row.videoId)).map((row) => [row.videoId, row]))).finally(() => loading = null);
    return loading;
  };
  async function pack(rows) {
    const vectors = await embed(rows.map((row) => row.text));
    return rows.map((row, i) => ({ ...row, ...quantize(vectors[i]) }));
  }
  async function save(input, rows, { replaceSource, replaceRange, imported = false, restore = false, pageFingerprint, indexedAt } = {}) {
    const started = epoch, video = await cleanItem({ ...input, watchedAt: input.watchedAt || Date.now() }), title = { start: 0, text: video.title, source: video.kind === "search" ? "Search" : "Title" };
    const packed = await pack([title, ...rows].slice(0, WEB_PASSAGES));
    if (started !== epoch) return { disabled: true };
    const result = await db.items.put({ ...video, ...indexedAt ? { indexedAt } : {} }, packed, { replaceSource, replaceRange, imported, restore, pageFingerprint });
    if (metadata) metadata.set(video.videoId, result.video);
    onChange();
    return result;
  }
  return {
    cancel() {
      epoch++;
    },
    metadata: cache,
    async refresh(id) {
      if (metadata) {
        const row = await db.getVideo(id);
        if (row) metadata.set(id, row);
        else metadata.delete(id);
      }
    },
    reset() {
      metadata = null;
      epoch++;
    },
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
      for (const video of valid) {
        if (started !== epoch) throw Error("History import stopped for a library change. Saved items remain; re-import to continue.");
        const old = await db.getVideo(video.videoId);
        if (old && old.watchedAt >= video.watchedAt) {
          skipped++;
          continue;
        }
        const saved = await save(video, [], { imported: true });
        if (saved.disabled) throw Error("History import stopped for a library change. Re-import to continue.");
        imported++;
      }
      return { imported, skipped };
    },
    async capture(input) {
      const started = epoch, video = await cleanItem({ ...input, watchedAt: Date.now() }), hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(video.title + "|" + String(input.text || ""))), pageFingerprint = Array.from(new Uint8Array(hash)).join(","), old = await db.items.get(video.videoId);
      if (started !== epoch) return { disabled: true };
      if (old?.pageFingerprint === pageFingerprint && (!input.text || old.passages.some((row) => row.source === "Page text"))) {
        await db.touchWatch(video.videoId, Date.now());
        if (metadata) metadata.set(video.videoId, await db.getVideo(video.videoId));
        return { ok: true, unchanged: true };
      }
      return save(video, pagePassages(input.text), { replaceSource: "Page text", pageFingerprint });
    },
    async media(video, segments, source, replaceRange) {
      if (!["Transcript", "Audio"].includes(source) || !Array.isArray(segments) || segments.length > 160) throw Error("Invalid played-video transcript.");
      const rows = segments.filter((row) => Number.isFinite(row.start) && row.start >= 0 && row.start <= 86400 * 30 && typeof row.text === "string" && row.text.trim()).map((row) => ({ start: row.start, text: row.text.trim().slice(0, 2e3), source, ...replaceRange ? { speechStart: replaceRange[0], speechEnd: replaceRange[1] } : {} }));
      if (!rows.length) return { ok: true, empty: true };
      return save({ ...video, kind: "video", watchedAt: Date.now() }, rows, { replaceRange });
    },
    async restore(input) {
      const valid = await cleanItem(input), rows = Array.isArray(input.passages) ? input.passages : [];
      if (rows.length > WEB_PASSAGES) throw Error("Too many saved page passages.");
      const sources = new Set(["Page text", "Transcript", "Audio"]);
      for (const row of rows) if (!row || !sources.has(row.source) || typeof row.text !== "string" || row.text.length > 4e3 || !Number.isFinite(row.start) || row.start < 0 || row.start > 86400 * 30 || row.anchor !== void 0 && (typeof row.anchor !== "string" || row.anchor.length > 500)) throw Error("Invalid saved page passage.");
      for (const row of rows) if (row.speechStart !== void 0 || row.speechEnd !== void 0) {
        if (!Number.isFinite(row.speechStart) || !Number.isFinite(row.speechEnd) || row.speechStart < 0 || row.speechEnd <= row.speechStart || row.speechEnd - row.speechStart > 180) throw Error("Invalid saved audio range.");
      }
      const date = Number(input.indexedAt);
      return save(valid, rows, { restore: true, imported: input.historyImported === true, indexedAt: Number.isFinite(date) && date > 0 && date <= Date.now() + 6e4 ? date : Date.now() });
    },
    async search(query, vector, { sinceMs = 0, kind = "all", perVideo = 2, limit = 2048 } = {}) {
      const records = await cache(), best = [], terms = queryTerms(query);
      await db.items.scan((item) => {
        const video = records.get(item.id);
        if (!video || kind !== "all" && video.kind !== kind || sinceMs && (video.watchedAt || video.indexedAt || 0) < sinceMs) return;
        const hits = item.passages.map((row) => webHit(query, vector, video, row, terms)).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, perVideo);
        best.push(...hits);
        if (best.length > limit + 512) {
          best.sort((a, b) => b.score - a.score);
          best.length = limit;
        }
      });
      return best.sort((a, b) => b.score - a.score || a.videoId.localeCompare(b.videoId)).slice(0, limit);
    }
  };
}
