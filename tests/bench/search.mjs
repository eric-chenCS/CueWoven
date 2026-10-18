// Run from the repository: node tests/bench/search.mjs. No browser/user data.
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { rank, normalizedPassage } from "../../lib/search.js";
import {warmLexical} from '../../lib/lexical-cache.js';
const baseline = execFileSync("git", ["show", "029eaf2:lib/search.js"], { encoding: "utf8" });
const { rank: oldRank } = await import("data:text/javascript;base64," + Buffer.from(baseline).toString("base64"));
const text = "Café reef science discusses coral bleaching, ocean temperatures, and the symbiotic algae that provide nutrients. ".repeat(12), dim = 384, matrix = new Float32Array(3e4 * dim), q = new Float32Array(dim), videos = new Map(), meta = [];
q[0] = 1;
for (let i = 0; i < 3e4; i++) {
  const videoId = "page" + Math.floor(i / 15);
  videos.set(videoId, { videoId, title: "Ocean science " + Math.floor(i / 15), channel: "example.com" });
  meta.push(normalizedPassage({ videoId, start: i % 15 * 140, text: text + " Observation " + i + "." }));
  matrix[i * dim] = 0.2 + i % 100 * 1e-3;
}
const index = { matrix, dim, meta }, options = { query: "why corals lose color in warm water", perVideo: 1, limit: 12 };
const measure = (fn) => {
  const start = performance.now(), result = fn(q, index, videos, options);
  return { ms: performance.now() - start, ids: result.map((row) => row.videoId + ":" + row.start) };
};
await warmLexical(meta);
const before = measure(oldRank), after = measure(rank);
if (JSON.stringify(before.ids) !== JSON.stringify(after.ids)) throw Error("Rank order changed in the full-passage benchmark");
console.log(JSON.stringify({ passages: meta.length, items: videos.size, wordsPerPassage: meta[0].text.split(" ").length, beforeMs: before.ms, afterMs: after.ms, speedup: before.ms / after.ms, scope: "Synthetic 30,000 full passages; cached normalization excludes one-time migration; in-memory ranking only, excluding IndexedDB, model loading and query embedding." }, null, 2));
if(after.ms>Number(process.env.RECALL_RANK_BUDGET_MS||400))throw Error('Full-passage ranking exceeded the calibrated performance budget. Re-profile before adjusting RECALL_RANK_BUDGET_MS for another machine.');
