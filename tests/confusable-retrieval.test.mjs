// Accuracy guard on same-topic videos, using stored real MiniLM vectors (no browser, no download).
// Fixture: tests/fixtures/confusable.mjs. Vectors: tests/fixtures/confusable-vectors.json.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rank} from '../lib/search.js';
import {embeddingText} from '../lib/embedding-migration.js';
import * as original from './fixtures/retrieval.mjs';
import * as confusable from './fixtures/confusable.mjs';

const data = JSON.parse(fs.readFileSync(new URL('./fixtures/confusable-vectors.json', import.meta.url), 'utf8'));
const unpack = b64 => {const bytes = Buffer.from(b64, 'base64'), out = new Float32Array(bytes.length);for (let i = 0; i < bytes.length; i++) out[i] = ((bytes[i] << 24) >> 24) / 127;return out;};
const all = unpack(data.vectors), position = new Map(data.texts.map((text, i) => [text, i]));
const vectorOf = text => {const i = position.get(text);assert.ok(i !== undefined, 'missing vector for: ' + text + ' (regenerate the vectors)');return all.subarray(i * data.dim, (i + 1) * data.dim);};

function evaluate(videos, queries, vectorFor, isRight) {
  const rows = videos.flatMap(video => video.chunks.map(chunk => ({videoId: video.videoId, start: chunk.start, end: chunk.end, text: chunk.text, video})));
  const matrix = new Float32Array(rows.length * data.dim);rows.forEach((row, i) => matrix.set(vectorFor(row, i), i * data.dim));
  const records = new Map(videos.map(video => [video.videoId, {...video, method: video.method || 'captions', watchedAt: 1}]));
  let video = 0, moment = 0;
  for (const q of queries) {
    const results = rank(vectorOf(q.query), {matrix, dim: data.dim, meta: rows.map(({video, ...row}) => row)}, records, {query: q.query, limit: 20, perVideo: 1});
    if (results[0]?.videoId === q.videoId) video++;
    if (results[0] && isRight(results[0], q, rows)) moment++;
  }
  return {video, moment, total: queries.length};
}

test('the original retrieval fixture keeps every labeled moment', () => {
  const queries = original.queries.map(([query, videoId, start]) => ({query, videoId, starts: [start]}));
  const r = evaluate(original.videos, queries, row => vectorOf(embeddingText(row.video, row.text)), (hit, q) => hit.videoId === q.videoId && q.starts.includes(hit.start));
  assert.equal(r.moment, r.total);
});

test('same-topic videos: the right video comes first', () => {
  const r = evaluate(confusable.videos, confusable.queries, row => vectorOf(row.text), (hit, q) => hit.videoId === q.videoId && q.starts.includes(hit.start));
  // v3.3.10 scored 114/121 here. Keep the gain.
  assert.ok(r.video >= 120, `right video first for ${r.video}/${r.total}`);
  assert.ok(r.moment >= 117, `right moment first for ${r.moment}/${r.total}`);
});

test('same-topic videos with auto-caption text and real chunking', () => {
  const vectors = unpack(data.captions.vectors), clean = new Map(confusable.videos.map(video => [video.videoId, video]));
  const passageEnd = (videoId, start) => {const chunks = clean.get(videoId).chunks, i = chunks.findIndex(c => c.start === start);return chunks[i + 1]?.start ?? start + 120;};
  const r = evaluate(data.captions.videos, confusable.queries, (row, i) => vectors.subarray(i * data.dim, (i + 1) * data.dim),
    (hit, q, rows) => hit.videoId === q.videoId && q.starts.some(start => {const row = rows.find(x => x.videoId === hit.videoId && x.start === hit.start);return row.start < passageEnd(q.videoId, start) && row.end >= start;}));
  // v3.3.10 scored 107/121 here.
  assert.ok(r.video >= 119, `right video first for ${r.video}/${r.total}`);
});
