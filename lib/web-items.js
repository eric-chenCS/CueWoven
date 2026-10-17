import "./web-policy.js";
import { videoIdFromUrl } from "./video.js";
import { cleanWatchTitle } from "./takeout.js";
import { prepareQuery, scoredEvidence } from "./search.js";
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
  const title = String(input.title || "").replace(/[\p{Cc}\p{Cf}]/gu, " ").trim().slice(0, 300);
  if (!title) throw Error("A history title is required.");
  return { ...identity, itemId: identity.videoId, kind: input.kind, title, channel: new URL(identity.url).hostname, watchedAt, ...input.mediaKey ? { mediaKey: String(input.mediaKey).slice(0, 100) } : {}, ...input.audioLanguage ? { audioLanguage: String(input.audioLanguage).slice(0, 30) } : {} };
}
export function pagePassages(text) {
  const blocks = [], words = [], out = [];
  for (const line of String(text || "").slice(0, 6e4).split(/\n+/)) {
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
export function webHit(query, queryVector, video, row, prepared = prepareQuery(query)) {
  const semanticScore = packedDot(queryVector, row);
  if (!Number.isFinite(semanticScore)) return null;
  const lexical = scoredEvidence(prepared, row, video, semanticScore, 0.15);
  if (!lexical) return null;
  return { videoId: video.videoId, itemId: video.videoId, kind: video.kind, url: video.url, mediaKey: video.mediaKey, title: video.title, channel: video.channel, watchedAt: video.watchedAt, indexedAt: video.indexedAt, start: row.start, text: row.text, anchor: row.anchor, titleOnly: row.source === "Title", pageText: row.source === "Page text", speechGenerated: row.source === "Audio", matchSources: [row.source], score: semanticScore + 0.12 * lexical.coverage + (lexical.phrase ? 0.18 : 0) + (lexical.quoted ? 1 : 0) + lexical.context };
}
export function itemLink(hit) {
  if (!policy.webId(hit.videoId)) return null;
  const url = policy.safeUrl(hit.url);
  if (!url) return null;
  if (hit.pageText) {
    const phrase = String(hit.anchor || hit.text || "").slice(0, 500).split(/\s+/).slice(0, 20).join(" ");
    url.hash = ":~:text=" + encodeURIComponent(phrase).replace(/-/g, "%2D");
  } else if (!hit.titleOnly && hit.kind === "video") url.hash = "recall-time=" + Math.max(0, Math.floor(hit.start - (hit.screenText ? 3 : 0))) + (hit.mediaKey ? "&recall-media=" + encodeURIComponent(hit.mediaKey) : "");
  return url.href;
}
export function parseWebHistory(data) {
  const rows = Array.isArray(data) ? data : data?.["Browser History"];
  if (!Array.isArray(rows)) throw Error("Choose JSON Chrome BrowserHistory or Google Search My Activity.");
  const unique = new Map();
  const videos = new Map();
  let skipped = 0, youtube = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      skipped++;
      continue;
    }
    let address = row.url || row.titleUrl;
    for (let hop = 0; hop < 3; hop++) {
      let redirect;
      try {
        redirect = new URL(address);
      } catch {
        break;
      }
      if (!/^(?:www\.)?google\.[a-z.]+$/i.test(redirect.hostname) || redirect.pathname !== "/url") break;
      address = redirect.searchParams.get("q") || redirect.searchParams.get("url") || "";
    }
    const url = policy.safeUrl(address);
    if (!url) {
      skipped++;
      continue;
    }
    const watchedAt = row.time_usec !== void 0 ? Number(row.time_usec) / 1e3 : Date.parse(row.time || "");
    if (!Number.isFinite(watchedAt) || watchedAt <= 0 || watchedAt > Date.now() + 6e4) {
      skipped++;
      continue;
    }
    const videoId = videoIdFromUrl(url.href);
    if (videoId) {
      const title2 = cleanWatchTitle(String(row.title || "").replace(/^(?:Visited|Visitaste|Has visitado|Vous avez consulté|Besucht|Visitou)\s+/iu, ""));
      if (!title2) {
        skipped++;
        continue;
      }
      const old2 = videos.get(videoId);
      if (!old2 || old2.watchedAt < watchedAt) videos.set(videoId, { videoId, title: title2, watchedAt, channel: String(row.subtitles?.[0]?.name || "").slice(0, 200) });
      youtube++;
      continue;
    }
    const search = /^(?:www\.)?google\.[a-z.]+$/i.test(url.hostname) && url.pathname === "/search";
    let title = search ? url.searchParams.get("q") || String(row.title || "").replace(/^(?:Searched for|Has buscado|Vous avez recherché|Gesucht nach|Pesquisou por)\s+/iu, "") : String(row.title || "");
    title = title.replace(/^(?:Visited|Visitaste|Has visitado|Vous avez consulté|Besucht|Visitou)\s+/iu, "").trim().slice(0, 300);
    if (!title) {
      skipped++;
      continue;
    }
    const old = unique.get(url.href);
    if (!old || old.watchedAt < watchedAt) unique.set(url.href, { kind: search ? "search" : "page", url: url.href, title, watchedAt });
  }
  return { items: [...unique.values()].sort((a, b) => b.watchedAt - a.watchedAt), videos: [...videos.values()], skipped, youtube };
}
