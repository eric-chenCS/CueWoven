import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkTranscript } from '../lib/chunk.js';
import { rank, queryTerms, formatTime, deepLink } from '../lib/search.js';

const seg = (start, words) => ({ start, dur: 2, text: Array.from({ length: words }, (_, i) => `w${start}_${i}`).join(' ') });

test('chunks are ~target words, overlap by about half, and keep the first line start', () => {
  const segs = Array.from({ length: 40 }, (_, i) => seg(i * 3, 8)); // 320 words
  const chunks = chunkTranscript(segs, { targetWords: 40 });
  assert.ok(chunks.length >= 12 && chunks.length <= 17, `got ${chunks.length}`);
  for (const c of chunks.slice(0, -1)) assert.equal(c.text.split(' ').length, 40);
  assert.equal(chunks[0].start, 0);
  assert.equal(chunks[1].start, 9); // starts at the 4th line: 50% overlap
  const lastWord = segs.at(-1).text.split(' ').at(-1);
  assert.ok(chunks.at(-1).text.endsWith(lastWord), 'last chunk reaches the end');
});

test('chunking handles short, empty and unsorted input', () => {
  assert.deepEqual(chunkTranscript([]), []);
  assert.deepEqual(chunkTranscript([{ start: 1, text: '   ' }]), []);
  const out = chunkTranscript([{ start: 5, text: 'second' }, { start: 1, text: 'first' }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].text, 'first second');
  assert.equal(out[0].start, 1);
});

test('chunking always progresses even with one huge line', () => {
  const out = chunkTranscript([seg(0, 200), seg(10, 3), seg(20, 3)], { targetWords: 40 });
  assert.ok(out.length >= 2 && out.length <= 3);
});

function unit(...xs) {
  const n = Math.hypot(...xs);
  return Float32Array.from(xs.map((x) => x / n));
}

function makeIndex(rows) {
  const dim = rows[0].vec.length;
  const matrix = new Float32Array(rows.length * dim);
  rows.forEach((r, i) => matrix.set(r.vec, i * dim));
  return { matrix, dim, meta: rows.map(({ videoId, start, text }) => ({ videoId, start, text })) };
}

const now = Date.now();
const videos = new Map([
  ['A', { videoId: 'A', title: 'Black holes explained', channel: 'Space', indexedAt: now }],
  ['B', { videoId: 'B', title: 'Lithium-Ion Physics Breakdown', channel: 'Lab', indexedAt: now - 40 * 864e5 }],
]);

test('rank orders by similarity, caps per video and drops near-duplicates', () => {
  const index = makeIndex([
    { videoId: 'A', start: 10, text: 'event horizon', vec: unit(1, 0, 0) },
    { videoId: 'A', start: 18, text: 'event horizon overlap', vec: unit(0.99, 0.1, 0) },
    { videoId: 'A', start: 120, text: 'spaghettification', vec: unit(0.9, 0.3, 0) },
    { videoId: 'A', start: 300, text: 'hawking radiation', vec: unit(0.8, 0.4, 0) },
    { videoId: 'B', start: 42, text: 'batteries decay over cycles', vec: unit(0, 1, 0) },
  ]);
  const res = rank(unit(1, 0.05, 0), index, videos, { perVideo: 2, minScore: 0 });
  assert.equal(res[0].videoId, 'A');
  assert.equal(res[0].start, 10);
  assert.equal(res.filter((r) => r.videoId === 'A').length, 2);
  assert.ok(!res.some((r) => r.start === 18), 'overlapping neighbour removed');
  assert.ok(res.every((r, i) => i === 0 || res[i - 1].score >= r.score));
});

test('rank honours the recency filter and keyword boost', () => {
  const index = makeIndex([
    { videoId: 'A', start: 1, text: 'gravity wells', vec: unit(1, 1, 0) },
    { videoId: 'B', start: 2, text: 'batteries decay', vec: unit(1, 1, 0) },
  ]);
  const recent = rank(unit(1, 1, 0), index, videos, { sinceMs: now - 7 * 864e5, minScore: 0 });
  assert.deepEqual(recent.map((r) => r.videoId), ['A']);
  const boosted = rank(unit(1, 1, 0), index, videos, { query: 'why batteries decay', minScore: 0 });
  assert.equal(boosted[0].videoId, 'B');
});

test('helpers', () => {
  assert.deepEqual(queryTerms('That video where the guy explains Black Holes'), ['black', 'holes']);
  assert.equal(formatTime(65), '1:05');
  assert.equal(formatTime(3725.9), '1:02:05');
  assert.equal(deepLink('abc_DEF-123', 252.7), 'https://www.youtube.com/watch?v=abc_DEF-123&t=252s');
});

test('title-only history matches are marked and filtered by their original watch date',()=>{
  const saved = new Map([['A',{videoId:'A',title:'Batteries',indexedAt:now,watchedAt:now-40*864e5,method:'history-title'}]]);
  const index=makeIndex([{videoId:'A',start:0,text:'Batteries',vec:unit(1,0,0)}]);
  assert.equal(rank(unit(1,0,0),index,saved)[0].titleOnly,true);
  assert.deepEqual(rank(unit(1,0,0),index,saved,{sinceMs:now-7*864e5}),[]);
});
