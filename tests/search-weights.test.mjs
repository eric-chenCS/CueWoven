import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rank, prepareQuery, termWeights, termMask, passageEvidence, matchStrength} from '../lib/search.js';
import {webHit} from '../lib/web-items.js';

const vector = score => new Float32Array([score, Math.sqrt(1 - score * score)]);
function search(rows, query, options = {}) {
  const matrix = new Float32Array(rows.flatMap(row => Array.from(vector(row.similarity))));
  const videos = new Map(rows.map(row => [row.videoId, {title: row.title || '', channel: row.channel || '', method: 'captions', watchedAt: 100}]));
  return rank(new Float32Array([1, 0]), {matrix, dim: 2, meta: rows.map(row => ({...row}))}, videos, {query, perVideo: 1, ...options});
}

test('words found in few passages weigh more than words found everywhere', () => {
  const weights = termWeights(['battery', 'spaghettification'], ['battery life', 'battery heat', 'battery cycles', 'spaghettification near a black hole']);
  assert.ok(weights.get('spaghettification') > weights.get('battery'));
});

test('the distinctive word decides between two videos on the same topic', () => {
  const out = search([
    {videoId: 'sei', start: 30, text: 'The battery film on the anode traps lithium.', similarity: .5},
    {videoId: 'phone', start: 20, text: 'Optimized charging keeps the battery at eighty overnight.', similarity: .5},
    {videoId: 'ev', start: 45, text: 'Coolant plates keep the battery cool.', similarity: .5},
    {videoId: 'more', start: 9, text: 'Battery battery battery.', similarity: .1},
  ], 'battery overnight');
  assert.equal(out[0].videoId, 'phone');
});

test('keeping two query words together beats the same words scattered', () => {
  const out = search([
    {videoId: 'scattered', start: 0, text: 'Trapped heat near the lithium anode.', similarity: .5},
    {videoId: 'together', start: 0, text: 'Cycling leaves lithium trapped on the anode.', similarity: .5},
  ], 'lithium trapped anode');
  assert.equal(out[0].videoId, 'together');
  assert.deepEqual(prepareQuery('the lithium trapped').pairs, ['lithium trapped']);
});

test('a title word counts toward the right video', () => {
  const out = search([
    {videoId: 'gummy', start: 140, title: 'Why is my sourdough gummy?', text: 'Cutting the bread while it is hot makes it gummy.', similarity: .37},
    {videoId: 'cold', start: 120, title: 'Cold brew at home', text: 'Hot water extracts more sharp compounds.', similarity: .41},
  ], 'cut sourdough while hot');
  assert.equal(out[0].videoId, 'gummy');
});

test('naming the channel picks that channel among similar videos', () => {
  const rows = [
    {videoId: 'sei', start: 280, channel: 'Lab Notes', text: 'Batteries are worn out at eighty percent capacity.', similarity: .55},
    {videoId: 'ev', start: 300, channel: 'Motor Explained', text: 'Packs keep eighty five percent of their range.', similarity: .48},
  ];
  assert.equal(search(rows, 'battery degradation')[0].videoId, 'sei');
  assert.equal(search(rows, 'the Motor Explained video on battery degradation')[0].videoId, 'ev');
});

test('a named channel is found even when the query says nothing else', () => {
  const out = search([
    {videoId: 'roth', start: 30, channel: 'Retire Smart', text: 'Pay tax now and withdraw tax free later.', similarity: .05},
    {videoId: 'other', start: 10, channel: 'Lab Notes', text: 'A video about something else.', similarity: .2},
  ], 'the Retire Smart video');
  assert.equal(out[0].videoId, 'roth');
});

test('a one-word channel that is also an ordinary word needs to be used as a source', () => {
  const rows = [{videoId: 'misleading', start: 20, channel: 'Battery', text: 'A sandwich recipe.', similarity: .01}];
  assert.equal(search(rows, 'battery chemistry').length, 0);
  assert.equal(search(rows, 'the Battery video')[0].videoId, 'misleading');
});

test('a second matching moment lifts a video over a single passing mention', () => {
  const out = search([
    {videoId: 'single', start: 10, text: 'One strong mention.', similarity: .6},
    {videoId: 'both', start: 10, text: 'First related part.', similarity: .58},
    {videoId: 'both', start: 200, text: 'Second related part.', similarity: .55},
  ], 'remembered video');
  assert.equal(out[0].videoId, 'both');
});

test('results say whether they contain your distinctive words', () => {
  const out = search([
    {videoId: 'close', start: 10, text: 'Liquid coolant plates under the pack.', similarity: .5},
    {videoId: 'related', start: 10, text: 'Keeping cells near room temperature.', similarity: .55},
  ], 'coolant plates');
  assert.equal(out.find(hit => hit.videoId === 'close').match, 'close');
  assert.equal(out.find(hit => hit.videoId === 'related').match, 'related');
  assert.equal(matchStrength({quoted: true, phrase: false, coverage: 0}), 'close');
});

test('word masks only count whole words, and evidence can reuse them', () => {
  const terms = ['car', 'paint'];
  assert.equal(termMask(terms, 'carbon paint'), 0b10);
  const prepared = prepareQuery('car paint');
  assert.deepEqual(passageEvidence('car paint', prepared.terms, 'wash the car paint', '', '', prepared, termMask(prepared.terms, 'wash the car paint')),
    passageEvidence('car paint', prepared.terms, 'wash the car paint', '', '', prepared));
});

test('website items use the same score as videos', () => {
  const prepared = prepareQuery('coral bleaching');
  const row = {start: 0, text: 'Coral bleaching in warm water', lexicalText: 'coral bleaching in warm water', vec: new Float32Array([1, 0]), scale: .5, source: 'Page text'};
  const hit = webHit('coral bleaching', new Float32Array([1, 0]), {videoId: 'web_' + 'a'.repeat(64), title: 'Reefs', channel: 'example.com', kind: 'page'}, row, prepared);
  assert.equal(hit.match, 'close');
  const [video] = search([{videoId: 'v', start: 0, title: 'Reefs', channel: 'example.com', text: 'Coral bleaching in warm water', similarity: .5}], 'coral bleaching', {prepared: prepareQuery('coral bleaching', undefined, prepared.weights)});
  assert.ok(Math.abs(video.score - hit.score) < 1e-6);
});

// ---- Review findings: each case reproduced before the fix ----
import {createWebEngine} from '../offscreen/web-engine.js';
import {fuseMatches} from '../lib/scenes.js';
import * as searchModule from '../lib/search.js';

const permutations = list => list.length <= 1 ? [list] : list.flatMap((item, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map(rest => [item, ...rest]));

test('passage order never changes the winner (whole-video support is order independent)', () => {
  const rows = [
    {videoId: 'a', start: 0, text: 'Saved passage', similarity: .3},
    {videoId: 'a', start: 10, text: 'Saved passage', similarity: .9},
    {videoId: 'a', start: 30, text: 'Saved passage', similarity: .6},
    {videoId: 'b', start: 0, text: 'Saved passage', similarity: .94},
  ];
  const winners = new Set(permutations(rows).map(order => search(order, 'remembered video')[0].videoId));
  assert.equal(winners.size, 1, 'every order picks the same video');
});

function webFixture(rows) {
  const ids = rows.map((_, i) => 'web_' + i.toString(16).padStart(64, '0'));
  const records = rows.map((row, i) => ({videoId: ids[i], kind: 'video', title: 'Saved clip', channel: 'example.com', watchedAt: 1, label: row.videoId}));
  const engine = createWebEngine({db: {listVideos: async () => records, items: {searchScan: async visit => rows.forEach((row, i) => visit({id: ids[i], passages: [{...row, vec: vector(row.similarity), scale: 1, source: 'Transcript'}]}))}}, embed: async () => { throw Error('not needed'); }});
  return {engine, label: id => records[ids.indexOf(id)].label};
}
const distractorRows = [
  {videoId: 'topic', start: 0, text: 'hot climate radiation', similarity: .5},
  {videoId: 'bread', start: 0, text: 'sourdough starter jar', similarity: .49},
  ...Array.from({length: 8}, (_, i) => ({videoId: 'd' + i, start: 0, text: 'hot climate', similarity: 0})),
];

test('website items (Reels, TikTok, pages) get the same distinctive-word ranking as YouTube', async () => {
  assert.equal(search(distractorRows, 'hot sourdough')[0].videoId, 'bread');
  const {engine, label} = webFixture(distractorRows);
  const web = await engine.search('hot sourdough', vector(1), {kind: 'video', perVideo: 1});
  assert.equal(label(web[0].videoId), 'bread');
});

test('one search counts words across YouTube, website items and older batches together', async () => {
  // "hot" is common only among website items; it must still count as common for YouTube passages.
  const pool = searchModule.createPool(prepareQuery('hot sourdough'));
  const youtube = [{videoId: 'yt-topic', start: 0, text: 'hot climate radiation', similarity: .5}, {videoId: 'yt-bread', start: 0, text: 'sourdough starter jar', similarity: .49}];
  searchModule.addIndex(pool, new Float32Array([1, 0]), {dim: 2, matrix: Float32Array.from(youtube.flatMap(r => [...vector(r.similarity)])), meta: youtube.map(r => ({...r}))}, new Map(youtube.map(r => [r.videoId, {title: 'Saved clip', channel: 'example.com', watchedAt: 1}])));
  const {engine} = webFixture(distractorRows.slice(2));
  await engine.collect(pool, vector(1), {kind: 'all'});
  const ranked = searchModule.rankPool(pool, {perVideo: 1, limit: 20});
  assert.equal(ranked[0].videoId, 'yt-bread');
  assert.ok(pool.prepared.weights.get('sourdough') > pool.prepared.weights.get('hot'));
});

test('title and channel evidence is computed with the final word weights', () => {
  const prepared = prepareQuery('hot sourdough');
  passageEvidence('hot sourdough', prepared.terms, 'x', 'Sourdough tips', 'Kitchen', prepared); // cached before weights exist
  const pool = searchModule.createPool(prepared);
  const rows = [{videoId: 'v', start: 0, title: 'Sourdough tips', text: 'hot hot', similarity: .5}, ...Array.from({length: 6}, (_, i) => ({videoId: 'h' + i, start: 0, text: 'hot', similarity: .1}))];
  searchModule.addIndex(pool, new Float32Array([1, 0]), {dim: 2, matrix: Float32Array.from(rows.flatMap(r => [...vector(r.similarity)])), meta: rows.map(r => ({...r}))}, new Map(rows.map(r => [r.videoId, {title: r.title || '', channel: 'Kitchen', watchedAt: 1}])));
  searchModule.rankPool(pool, {perVideo: 1});
  const fresh = prepareQuery('hot sourdough', undefined, prepared.weights);
  assert.equal(passageEvidence('hot sourdough', prepared.terms, 'x', 'Sourdough tips', 'Kitchen', prepared).context, passageEvidence('hot sourdough', fresh.terms, 'x', 'Sourdough tips', 'Kitchen', fresh).context);
});

test('the near-tie hint only compares scores from the same model', () => {
  const words = [{videoId: 'b', start: 0, score: .95, matchSources: ['Transcript']}, {videoId: 'a', start: 0, score: .5, matchSources: ['Transcript']}];
  const fused = fuseMatches(words, [{videoId: 'a', start: 0, score: .3}], {perVideo: 1});
  assert.equal(fused[0].videoId, 'a', 'scene evidence moved "a" first');
  assert.equal(searchModule.nearTie(fused), false, 'a scene-boosted result is not a tie with a 0.95 transcript match');
  assert.equal(searchModule.nearTie(words), false);
  assert.equal(searchModule.nearTie([{videoId: 'a', start: 0, score: .62, matchSources: ['Transcript']}, {videoId: 'a', start: 90, score: .61, matchSources: ['Transcript']}, {videoId: 'b', start: 0, score: .6, matchSources: ['Page text']}]), true);
  assert.equal(searchModule.nearTie([{videoId: 'a', start: 0, score: .62, matchSources: ['Transcript', 'Scene']}, {videoId: 'b', start: 0, score: .61, matchSources: ['Transcript']}]), false);
});

test('"Not this one" hides an item from website ranking while others still rank',async()=>{
  const {engine,label}=webFixture(distractorRows);
  const bread=(await engine.search('hot sourdough',vector(1),{kind:'video',perVideo:1})).find(hit=>label(hit.videoId)==='bread').videoId;
  const pool=searchModule.createPool(prepareQuery('hot sourdough'));
  await engine.collect(pool,vector(1),{kind:'video',hidden:new Set([bread])});
  const ranked=searchModule.rankPool(pool,{perVideo:1,limit:20});
  assert.ok(ranked.length>0);assert.ok(ranked.every(hit=>hit.videoId!==bread));
});
