import "./web-policy.js";
import { prepareQuery, scoredEvidence, evidenceScore, matchStrength } from "./search.js";
export const policy = globalThis.__recallWebPolicy;
export const WEB_WORDS = 2e3, WEB_PASSAGES = 160, WEB_BYTES = 64 * 1024 * 1024, WEB_FULL_ITEMS = 2e3;
export async function itemIdentity(value, mediaKey = "") {
  const url = policy.safeUrl(value);
  if (!url) throw Error("This address is private, sensitive or unsupported.");
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url.href + "|" + mediaKey));
  return { videoId: "web_" + Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join(""), url: url.href };
}
export async function cleanItem(input) {
  if (!input || !["page", "search", "video"].includes(input.kind)) throw Error("Invalid history item.");
  const identity = await itemIdentity(input.url, String(input.mediaKey || "").slice(0, 100));
  if (input.videoId && input.videoId !== identity.videoId) throw Error("History identity does not match its address.");
  const watchedAt = Number(input.watchedAt || input.visitedAt), now = Date.now();
  if (!Number.isFinite(watchedAt) || watchedAt <= 0 || watchedAt > now + 6e4) throw Error("Invalid history date.");
  const title = policy.redactText(input.title).replace(/[\p{Cc}\p{Cf}]/gu, " ").trim().slice(0, 300);
  if (!title) throw Error("A history title is required.");
  return { ...identity, itemId: identity.videoId,...(Number.isFinite(input.savedAt)&&input.savedAt>0&&input.savedAt<=Date.now()?{savedAt:input.savedAt}:{}), kind: input.kind, title, channel: new URL(identity.url).hostname, watchedAt, ...input.mediaKey ? { mediaKey: String(input.mediaKey).slice(0, 100) } : {}, ...input.audioLanguage ? { audioLanguage: String(input.audioLanguage).slice(0, 30) } : {} };
}
export function pagePassages(text) {
  const blocks = [], words = [], out = [];
  for (const line of policy.redactText(text).slice(0, 6e4).split(/\n+/)) {
    const tokens = line.split(/\s+/u).filter(Boolean).slice(0, WEB_WORDS - words.length);
    if (tokens.length) {
      blocks.push({ start: words.length, tokens });
      words.push(...tokens);
    }
    if (words.length >= WEB_WORDS) break;
  }
  for (let i = 0; i < words.length; i += 140) {
    const part = words.slice(i, i + 180).join(" ").slice(0, 4e3);
    const anchor = blocks.filter((block) => block.start < i + 180 && block.start + block.tokens.length > i).map((block) => block.tokens.slice(Math.max(0, i - block.start), Math.min(block.tokens.length, i + 180 - block.start))).filter((tokens) => tokens.length).sort((a, b) => b.length - a.length)[0]?.slice(0, 20).join(" ").slice(0, 500);
    if (part) out.push({ start: i, text: part, source: "Page text", anchor });
  }
  return out;
}
export function quantize(vec) {
  const max = Math.max(...Array.from(vec, Math.abs)), scale = max ? max / 127 : 1;
  return { vec: Int8Array.from(vec, (value) => Math.round(value / scale)), scale };
}
export function packedDot(query, row) {
  let score = 0;
  if (row.vec?.length !== query.length) return NaN;
  for (let i = 0; i < query.length; i++) score += query[i] * row.vec[i];
  return score * row.scale;
}
// Result object for one website passage (page, Reel, TikTok, search query).
export const webHitBuilder = (video, row) => (score, match) => ({ videoId: video.videoId, itemId: video.videoId, kind: video.kind, url: video.url, mediaKey: video.mediaKey, title: video.title, channel: video.channel, watchedAt: video.watchedAt, indexedAt: video.indexedAt, start: row.start, text: row.text, anchor: row.anchor, titleOnly: row.source === "Title", pageText: ["Page text","Image caption"].includes(row.source), speechGenerated: row.source === "Audio", matchSources: [row.source], score, match });
export function webHit(query, queryVector, video, row, prepared = prepareQuery(query)) {
  const semanticScore = packedDot(queryVector, row);
  if (!Number.isFinite(semanticScore)) return null;
  const lexical = scoredEvidence(prepared, row, video, semanticScore, 0.15);
  if (!lexical) return null;
  return webHitBuilder(video, row)(evidenceScore(semanticScore, lexical), matchStrength(lexical));
}
export function itemLink(hit) {
  if (!policy.webId(hit.videoId)) return null;
  const url = policy.safeUrl(hit.url);
  if (!url) return null;
  // Image captions are model-written, so they are not on the page to jump to.
  if (hit.pageText && hit.matchSources?.[0] !== "Image caption") {
    // Jump to where the shown snippet starts; passage-jump.js handles text crossing paragraphs.
    const words = String(hit.text || hit.anchor || "").slice(0, 500).split(/\s+/).filter(Boolean).slice(0, 20), enc = (part) => encodeURIComponent(part.join(" ")).replace(/-/g, "%2D");
    // Start,end fragment survives edits mid-passage; recall-text lets content/passage-jump.js retry when the browser misses.
    url.hash = "recall-text=" + enc(words) + ":~:text=" + (words.length > 8 ? enc(words.slice(0, 4)) + "," + enc(words.slice(-4)) : enc(words));
  } else if (!hit.titleOnly && hit.kind === "video") url.hash = "recall-time=" + Math.max(0, Math.floor(hit.start - (hit.screenText ? 3 : 0))) + (hit.mediaKey ? "&recall-media=" + encodeURIComponent(hit.mediaKey) : "");
  return url.href;
}
