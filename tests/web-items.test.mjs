import { test } from "node:test";
import assert from "node:assert/strict";
import { policy, cleanItem, itemIdentity, pagePassages, quantize, packedDot, itemLink, webHit } from "../lib/web-items.js";
import { restoreBackup } from "../lib/backup.js";
import { fuseMatches } from "../lib/scenes.js";
test("private addresses, credentials, local networks and sensitive paths are excluded", () => {
  for (const url of ["javascript:alert(1)", "file:///secret", "https://user:secret@example.com/", "http://localhost/", "http://127.0.0.1/", "https://[::1]/", "https://machine.local/", "https://mail.google.com/", "https://docs.google.com/", "https://example.gov/", "https://bank.example.com/", "https://example.com/messages/", "https://example.com/?access_token=secret"]) assert.equal(policy.safeUrl(url), null, url);
  assert.equal(policy.allowed("https://www.example.com/article", { enabled: false, allSites: true }), false);
  assert.equal(policy.allowed("https://www.example.com/article", { enabled: true, allSites: true, paused: true }), false);
  assert.equal(policy.allowed("https://www.example.com/article", { enabled: true, domains: ["example.com"] }), true);
  assert.equal(policy.allowed("https://www.example.com/article", { enabled: true, allSites: true, blocked: ["example.com"] }), false);
});
test('public topics and deep code paths survive while private entry routes stay excluded',()=>{
  for(const url of ['https://en.wikipedia.org/wiki/Email','https://en.wikipedia.org/wiki/Bank','https://en.wikipedia.org/wiki/Health','https://docs.python.org/3/library/email.html','https://github.com/team/repo/blob/main/global_settings.py','https://www.nytimes.com/section/health','https://stackoverflow.com/questions/123/how-to-login-with-oauth','https://example.com/health'])assert.ok(policy.safeUrl(url),url);
  for(const url of ['https://example.com/account/details','https://example.com/login','https://example.com/%61ccount/details','https://example.com/#/account/details','https://example.com/#/%2Faccount/details','https://example.com/mail/','https://mail.example.com/','https://mail.google.com/','https://example.com/?token=secret'])assert.equal(policy.safeUrl(url),null,url);
});
test("web identities are deterministic, namespaced and reject forged backup owners", async () => {
  const a = await itemIdentity("https://example.com/a?utm_source=test"), b = await itemIdentity("https://example.com/a");
  assert.equal(a.videoId, b.videoId);
  assert.equal(policy.webId(a.videoId), true);
  assert.equal(policy.ownerId(a.videoId), true);
  assert.equal(policy.ownerId("aaaaaaaaaaa"), true);
  assert.equal(policy.ownerId("web_fake"), false);
  await assert.rejects(cleanItem({ kind: "page", url: b.url, videoId: "web_" + "a".repeat(64), title: "Title", watchedAt: Date.now() }), /identity/);
  const media = await itemIdentity("https://example.com/a", "clip");
  assert.notEqual(a.videoId, media.videoId);
});
test("page passages and packed vectors stay bounded without losing a precise semantic match", () => {
  const rows = pagePassages(Array.from({ length: 3e3 }, (_, i) => "word" + i).join(" "));
  assert.ok(rows.length <= 15);
  assert.equal(rows.some((row) => row.text.includes("word2000")), false);
  assert.ok(pagePassages("x".repeat(6e4)).every((row) => row.text.length <= 4e3));
  const vector = Float32Array.from({ length: 384 }, (_, i) => Math.sin(i) * 0.071), length = Math.hypot(...vector);
  for (let i = 0; i < vector.length; i++) vector[i] /= length;
  const packed = quantize(vector);
  assert.equal(packed.vec.byteLength, vector.byteLength / 4);
  assert.ok(Math.abs(packedDot(vector, packed) - 1) < 2e-3);
  const hit = webHit("coral bleaching", vector, { videoId: "web_" + "a".repeat(64), kind: "page", url: "https://example.com", title: "Ocean science" }, { ...packed, source: "Page text", start: 0, text: "Coral bleaching occurs when warm water drives algae away." });
  assert.ok(hit.score > 0.9);
  assert.equal(hit.matchSources[0], "Page text");
});
test("page links highlight saved words and media links preserve site and playback lead-in", () => {
  const videoId = "web_" + "a".repeat(64), url = "https://example.com/article";
  const page = itemLink({ videoId, url, kind: "page", pageText: true, text: "Coral bleaching is caused by warm-water stress." });
  assert.match(page, /#recall-text=Coral%20bleaching.*:~:text=Coral%20bleaching/);
  const long = new URL(itemLink({ videoId, url, kind: "page", pageText: true, text: "one two three four five six seven eight nine ten" }));
  assert.ok(long.hash.endsWith(":~:text=one%20two%20three%20four,seven%20eight%20nine%20ten"));
  assert.equal(new URLSearchParams(long.hash.slice(1).split(":~:")[0]).get("recall-text"), "one two three four five six seven eight nine ten");
  assert.ok(page.includes("warm%2Dwater"));
  const video = itemLink({ videoId, url, kind: "video", screenText: true, start: 12 });
  assert.equal(video, "https://example.com/article#recall-time=9");
  assert.equal(itemLink({ videoId, url: "javascript:alert(1)", kind: "page" }), null);
  assert.ok(itemLink({ videoId, url, kind: "page", pageText: true, text: "Snippet words shown here", anchor: "Other paragraph words" }).includes("recall-text=Snippet"));
  assert.equal(itemLink({ videoId, url, kind: "page", pageText: true, text: "A red fish", matchSources: ["Image caption"] }), url);
});
test("text fragment anchors stay within one captured text block rather than crossing a heading", () => {
  const rows = pagePassages("Coral reefs\nCoral bleaching occurs when warm ocean water drives away the algae that feed the reef.");
  assert.match(rows[0].anchor, /^Coral bleaching/);
  assert.equal(rows[0].anchor.includes("Coral reefs"), false);
});
test("page word offsets are never treated as video times during scene fusion", () => {
  const words = [{ videoId: "aaaaaaaaaaa", start: 0, score: 0.8, pageText: true, matchSources: ["Page text"] }], scenes = [{ videoId: "aaaaaaaaaaa", start: 3, score: 0.4, key: "a", scene: true }];
  const result = fuseMatches(words, scenes, { perVideo: 2 });
  assert.equal(result.length, 2);
  assert.equal(result[0].matchSources.includes("Scene"), false);
});
test("backup restores web parents before their scene and OCR children", async () => {
  const calls = [];
  await restoreBackup({ format: "recall-export", videos: [], items: [{ videoId: "web_x" }], scenes: [{ videoId: "web_x" }], screenText: [{ videoId: "web_x" }] }, async (msg) => {
    calls.push(msg.data);
    return { imported: msg.data.items?.length || 0 };
  });
  assert.equal(calls[0].items.length, 1);
  assert.equal(calls[1].scenes.length, 1);
  assert.equal(calls[2].screenText.length, 1);
});
