import { test } from "node:test";
import assert from "node:assert/strict";
import { createWebEngine } from "../offscreen/web-engine.js";
const input = { kind: "page", url: "https://example.com/article", title: "Public science", watchedAt: 17e11, text: "Coral reefs lose their algae when ocean temperatures become too warm." };
function fixture(embed) {
  const records = new Map(), rows = new Map(), calls = [];
  const db = { listVideos: async () => [...records.values()], getVideo: async (id) => records.get(id), touchWatch: async (id, date) => {
    records.set(id, { ...records.get(id), watchedAt: date, historyImported: false });
  }, items: { get: async (id) => rows.get(id), put: async (video, passages, options) => {
    calls.push({ video, passages, options });
    records.set(video.videoId, video);
    rows.set(video.videoId, { id: video.videoId, passages, pageFingerprint: options.pageFingerprint });
    return { ok: true, video };
  } } };
  const engine = createWebEngine({ db, embed: embed || (async (texts) => texts.map(() => new Float32Array(384))) });
  return { engine, records, rows, calls };
}
test("unchanged page text reuses vectors, but evicted content can be indexed again", async () => {
  let embeddings = 0;
  const f = fixture(async (texts) => {
    embeddings++;
    return texts.map(() => new Float32Array(384));
  });
  await f.engine.capture(input);
  await f.engine.capture(input);
  assert.equal(embeddings, 1);
  const row = [...f.rows.values()][0];
  row.passages = row.passages.filter((p) => p.source === "Title");
  await f.engine.capture(input);
  assert.equal(embeddings, 2);
});
test("canceling a pending page embedding prevents a later write after deletion", async () => {
  let finish, signal;
  const ready = new Promise((resolve) => signal = resolve), f = fixture((texts) => {
    signal();
    return new Promise((resolve) => finish = () => resolve(texts.map(() => new Float32Array(384))));
  });
  const pending = f.engine.capture(input);
  await ready;
  f.engine.cancel();
  finish();
  assert.deepEqual(await pending, { disabled: true });
  assert.equal(f.calls.length, 0);
});
test("web history validates the entire batch before saving and rejects malformed backup passages", async () => {
  const f = fixture();
  await assert.rejects(f.engine.importItems([input, { ...input, url: "https://mail.google.com/" }]), /private|sensitive/);
  assert.equal(f.calls.length, 0);
  await assert.rejects(f.engine.restore({ ...input, passages: [{ source: "Page text", start: 0, text: "Valid text", anchor: "x".repeat(501) }] }), /Invalid saved/);
  assert.equal(f.calls.length, 0);
});
test("backup restoration keeps original indexing dates and packed audio ranges", async () => {
  const f = fixture(), indexedAt = 1700000001e3;
  await f.engine.restore({ ...input, indexedAt, historyImported: true, kind: "video", passages: [{ source: "Audio", start: 12, text: "Words actually heard.", speechStart: 10, speechEnd: 25 }] });
  const call = f.calls[0];
  assert.equal(call.video.indexedAt, indexedAt);
  assert.equal(call.options.restore, true);
  assert.equal(call.options.imported, true);
  assert.equal(call.passages.find((p) => p.source === "Audio").speechStart, 10);
  assert.ok(call.passages.every((p) => p.vec instanceof Int8Array));
});
