import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rerankCandidates, applyRerank} from '../lib/rerank.js';
import {createReranker} from '../offscreen/rerank-model.js';
import {readHeadTensor, scoreHead} from '../offscreen/rerank-head.js';

const hits = () => Array.from({length: 45}, (_, i) => ({videoId: `owner${i}`, title: `Title ${i}`, channel: 'Channel', text: `Passage ${i}`, start: i * 45, score: 0.3 - i / 1000, match: 'related'}));
const query = 'a speaker getting older with an aching back';
function fixture(options = {}) {
  const workers = [];
  class Worker extends EventTarget {
    constructor() {super();workers.push(this);}
    messages = [];
    postMessage(data) {this.messages.push(data);}
    terminate() {this.terminated = true;}
    send(data) {this.onmessage({data});}
  }
  const model = createReranker({WorkerClass: Worker, ...options});
  const load = async () => {const pending = model.warmup(); workers.at(-1).send({id: 0, ready: true}); assert.equal(await pending, true);};
  return {model, workers, load};
}

test('only weak text near ties invoke the model; literal, strong and visual evidence keep their ranking', () => {
  assert.equal(rerankCandidates(query, hits()).length, 10);
  for (const input of ['', '"old speaker"', '“old speaker”', 'bad quote "', 'q'.repeat(2001)]) assert.equal(rerankCandidates(input, hits()), null);
  assert.equal(rerankCandidates(query, []), null);
  assert.equal(rerankCandidates(query, hits().slice(0, 1)), null);
  for (const change of [{score: 0.6}, {match: 'close'}, {scene: true}, {articleImage: true}, {matchSources: ['Scene']}, {score: NaN}]) {
    const rows = hits(); Object.assign(rows[0], change); assert.equal(rerankCandidates(query, rows), null);
  }
  const rows = hits(); rows[19].match = 'close'; assert.equal(rerankCandidates(query, rows), null, 'check every shortlisted owner, not just the first ten');
  rows[19].match = 'related'; rows[20].match = 'close'; assert.equal(rerankCandidates(query, rows).length, 10, 'preserve the studied 20-owner gate');
});

test('model pairs contain the original title/channel and at most two retrieved passages per owner', () => {
  const rows = hits(); rows.splice(1, 0, {...rows[0], text: 'Second passage'}, {...rows[0], text: 'Third passage'});
  const candidates = rerankCandidates(query, rows);
  assert.equal(candidates[0].text, 'Title 0\nChannel\nPassage 0\nSecond passage');
  assert.equal(candidates[1].videoId, 'owner1');
  rows[0].text = 'x'.repeat(100000); assert.equal(rerankCandidates(query, rows)[0].text.length, 8192);
});

test('only a finite, correctly shaped score vector and clear winning margin may reorder results', () => {
  const rows = hits(), candidates = rerankCandidates(query, rows), scores = Array(10).fill(-2);
  for (const invalid of [null, [], [1, 2], Array(10).fill(NaN), Array(10).fill(Infinity), Array(10).fill(0)]) assert.equal(applyRerank(rows, candidates, invalid), rows);
  scores[1] = -1.01; assert.equal(applyRerank(rows, candidates, scores), rows);
  scores[1] = -1; const ranked = applyRerank(rows, candidates, scores);
  assert.equal(ranked[0], rows[1]); assert.equal(ranked[0].start, 45); assert.equal(ranked[0].score, rows[1].score);
  assert.deepEqual(ranked.slice(40), rows.slice(40)); assert.equal(new Set(ranked).size, rows.length);
  assert.deepEqual(rows.map(row => row.videoId), hits().map(row => row.videoId), 'never mutate the original cached order');
});

test('strong searches never construct a worker and cold weak searches return immediately while one load starts', async () => {
  const {model, workers} = fixture();
  try {
    const strong = hits(); strong[0].match = 'close'; assert.equal((await model.rerank(query, strong)).hits, strong); assert.equal(workers.length, 0);
    const rows = hits(); assert.deepEqual(await model.rerank(query, rows), {hits: rows, pending: true});
    await model.rerank(query, rows); assert.equal(workers.length, 1); assert.equal(workers[0].messages.length, 1);
    workers[0].send({id: 0, ready: true}); assert.equal(model.status().status, 'ready');
    const pending = model.rerank(query, rows), worker = workers[0], request = worker.messages.at(-1);
    assert.equal(request.query, query); assert.equal(request.documents.length, 10);
    worker.send({id: request.id + 1, scores: Array(10).fill(0)});
    worker.send({id: request.id, scores: [0, 3, ...Array(8).fill(-1)]});
    const result = await pending; assert.equal(result.applied, true); assert.equal(result.hits[0], rows[1]);
  } finally {model.release();}
});

test('inference deadlines stop the worker, keep the original results and back off before reloading', async () => {
  let clock = 0; const {model, workers, load} = fixture({timeoutMs: 15, cooldownMs: 100, now: () => clock});
  try {
    await load(); const rows = hits(), result = await model.rerank(query, rows);
    assert.equal(result.hits, rows); assert.equal(workers[0].terminated, true); assert.equal(model.status().status, 'cooldown');
    await model.rerank(query, rows); assert.equal(workers.length, 1);
    clock = 101; assert.equal((await model.rerank(query, rows)).pending, true); assert.equal(workers.length, 2);
  } finally {model.release();}
});

test('cancellation settles old inference, ignores late messages and does not queue newer queries', async () => {
  const {model, workers, load} = fixture();
  try {
    await load(); const rows = hits(), old = model.rerank(query, rows);
    assert.equal((await model.rerank('another vague memory', rows)).hits, rows); assert.equal(workers[0].messages.length, 2);
    model.cancel(); assert.equal((await old).hits, rows); assert.equal(workers[0].terminated, true);
    const warming = model.warmup(); workers[0].send({id: 0, ready: true}); workers[0].onerror(); assert.equal(model.status().status, 'loading');
    workers[1].send({id: 0, ready: true}); assert.equal(await warming, true);
  } finally {model.release();}
});

test('load failures, worker errors, idle expiry and malformed scores preserve usable ordinary search', async () => {
  const {model, workers} = fixture({loadTimeoutMs: 15, cooldownMs: 0, idleMs: 15});
  try {
    assert.equal(await model.warmup(), false); assert.equal(workers[0].terminated, true);
    const warming = model.warmup(); workers[1].send({id: 0, error: 'failure'}); assert.equal(await warming, false);
    const third = model.warmup(); workers[2].onerror(); assert.equal(await third, false);
    const fourth = model.warmup(); workers[3].send({id: 0, ready: true}); await fourth;
    const rows = hits(), pending = model.rerank(query, rows); workers[3].send({id: workers[3].messages.at(-1).id, scores: [NaN]});
    assert.equal((await pending).hits, rows);
    await new Promise(resolve => setTimeout(resolve, 35)); assert.equal(workers[3].terminated, true); assert.equal(model.status().status, 'idle');
  } finally {model.release();}
});

test('worker construction and message failures cannot turn optional reranking into a search error', async () => {
  const rows = hits();
  const broken = createReranker({WorkerClass: class {constructor() {throw Error('unavailable');}}});
  try {assert.equal((await broken.rerank(query, rows)).hits, rows);} finally {broken.release();}
  const {model, workers, load} = fixture();
  try {await load(); workers[0].postMessage = () => {throw Error('closed');}; assert.equal((await model.rerank(query, rows)).hits, rows);} finally {model.release();}
});

test('unreadable reranker messages preserve ordinary results and settle loading promptly',async()=>{
  const {model,workers,load}=fixture({cooldownMs:0});
  try{
    const warming=model.warmup();workers[0].dispatchEvent(new Event('messageerror'));assert.equal(workers[0].terminated,true);
    assert.equal(await warming,false);await load();
    const rows=hits(),pending=model.rerank(query,rows);workers[1].dispatchEvent(new Event('messageerror'));
    assert.equal((await pending).hits,rows);assert.equal(workers[1].terminated,true);
    const retry=model.warmup();workers[1].dispatchEvent(new Event('messageerror'));assert.equal(model.status().status,'loading');
    workers[2].send({id:0,ready:true});assert.equal(await retry,true);
  }finally{model.release();}
});

test('scoring head parses only expected finite F32 tensors and reads CLS rather than mean pooling', () => {
  function tensor(dtype = 'F32') {
    const bytes = new TextEncoder().encode(JSON.stringify({weight: {dtype, shape: [2], data_offsets: [0, 8]}})), buffer = new ArrayBuffer(8 + bytes.length + 8), view = new DataView(buffer);
    view.setBigUint64(0, BigInt(bytes.length), true); new Uint8Array(buffer, 8, bytes.length).set(bytes); view.setFloat32(8 + bytes.length, 1.5, true); view.setFloat32(12 + bytes.length, -2, true); return buffer;
  }
  assert.deepEqual([...readHeadTensor(tensor(), 'weight', [2])], [1.5, -2]);
  assert.throws(() => readHeadTensor(tensor('F16'), 'weight', [2]));
  assert.throws(() => readHeadTensor(tensor(), 'weight', [3]));
  assert.throws(() => readHeadTensor(new ArrayBuffer(8), 'weight', [2]));
  const dense = new Float32Array(384 * 384), output = new Float32Array(384), norm = new Float32Array(384).fill(1);
  for (let i = 0; i < 384; i++) dense[i * 384 + i] = 1;
  output[0] = 1;
  const head = {dense, output, norm, normBias: new Float32Array(384), bias: Float32Array.of(0.5)}, data = new Float32Array(2 * 384);
  data[0] = 1; data[384] = -100;
  const positive = scoreHead({data, dims: [1, 2, 384]}, head)[0];
  assert.ok(positive > 19 && positive < 21);
  data[384] = 100; assert.equal(scoreHead({data, dims: [1, 2, 384]}, head)[0], positive);
  assert.throws(() => scoreHead({data, dims: [1, 2, 383]}, head));
});
