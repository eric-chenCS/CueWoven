import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTranscriptQueue} from '../lib/transcript-queue.js';

const ids = count => Array.from({length: count}, (_, i) => String(i).padStart(11, 'a'));
const tick = () => new Promise(resolve => setImmediate(resolve));

test('background queue fetches at most three at once and continues after individual failures', async () => {
  let active = 0, max = 0;
  const snapshots = [];
  const queue = createTranscriptQueue({
    onChange: state => snapshots.push(state),
    processVideo: async videoId => {
      active++; max = Math.max(max, active);
      await tick();active--;
      if (videoId === ids(3)[1]) throw Error('Captions unavailable');
      return {status: videoId === ids(3)[2] ? 'skipped' : 'done'};
    },
  });
  queue.start(ids(8), 3);
  await queue.wait();
  const state = queue.get();
  assert.equal(max, 3);
  assert.equal(state.completed, 8);
  assert.equal(state.done, 6);assert.equal(state.failed, 1);assert.equal(state.skipped, 1);
  assert.equal(state.status, 'done');
  assert.ok(snapshots.every(s => s.active.length <= 3));
});

test('pause finishes only active videos, without needing any settings-page callback', async () => {
  const release = [];
  const queue = createTranscriptQueue({processVideo: async () => {
    await new Promise(resolve => release.push(resolve));return {status: 'done'};
  }});
  queue.start(ids(10), 3);await tick();
  assert.equal(release.length, 3);
  assert.equal(queue.pause().status, 'pausing');
  release.forEach(resolve => resolve());await queue.wait();
  assert.equal(queue.get().status, 'paused');
  assert.equal(queue.get().completed, 3);
  assert.equal(release.length, 3);
});

test('model warmup runs once and can be paused before opening transcript tabs', async () => {
  let ready, warmups = 0, calls = 0;
  const queue = createTranscriptQueue({beforeStart: () => {warmups++;return new Promise(resolve => ready = resolve);}, processVideo: async () => {calls++;return {status: 'done'};}});
  queue.start(ids(5));assert.equal(calls, 0);queue.pause();ready();await queue.wait();
  assert.equal(warmups, 1);assert.equal(calls, 0);assert.equal(queue.get().status, 'paused');
});

test('queue rejects competing jobs and invalid IDs, deduplicates inputs, and bounds logs', async () => {
  let ready;
  const queue = createTranscriptQueue({beforeStart: () => new Promise(resolve => ready = resolve),processVideo: async () => ({status: 'done'})});
  for (const invalid of [[], ['bad'], ['aaaaaaaaaaa&x=1']]) assert.throws(() => queue.start(invalid), /valid/);
  queue.start([...ids(106), ...ids(10)]);
  assert.throws(() => queue.start(ids(1)), /already/);
  ready();await queue.wait();
  assert.equal(queue.get().total, 106);assert.equal(queue.get().done, 106);assert.equal(queue.get().results.length, 100);
  const copy = queue.get();copy.status = 'running';copy.results.length = 0;
  assert.equal(queue.get().status, 'done');assert.equal(queue.get().results.length, 100);
});

test('interrupted worker state is reported honestly and does not restart work silently', () => {
  let calls = 0;
  const initial = {id: 'old', revision: 2, status: 'running', total: 5, completed: 1, done: 1, failed: 0, skipped: 0, active: [{videoId: ids(1)[0],tabId: 10}],results: []};
  const queue = createTranscriptQueue({initial, processVideo: () => {calls++;}});
  assert.equal(queue.get().status, 'interrupted');assert.deepEqual(queue.get().active, []);
  assert.equal(queue.get().completed, 1);assert.equal(calls, 0);
});

test('warmup errors stop the job with a useful message instead of hanging', async () => {
  const queue = createTranscriptQueue({beforeStart: async () => {throw Error('Model offline');}, processVideo: async () => ({status: 'done'})});
  queue.start(ids(1));await queue.wait();
  assert.equal(queue.get().status, 'interrupted');assert.equal(queue.get().reason, 'Model offline');
  assert.equal(queue.get().completed, 0);
});

for (const concurrency of [3, 6, 8, 12, undefined]) {
  test(`queue respects parallel limit ${concurrency ?? 'default 6'}`, async () => {
    let active = 0, peak = 0;
    const queue = createTranscriptQueue({processVideo: async () => {
      active++;peak = Math.max(peak, active);await tick();active--;return {status: 'done'};
    }});
    queue.start(ids(25), concurrency);await queue.wait();
    assert.equal(peak, concurrency ?? 6);
    assert.equal(queue.get().done, 25);
    assert.equal(queue.get().concurrency, concurrency ?? 6);
  });
}
test('invalid concurrency cannot open an unbounded number of tabs', () => {
  const queue = createTranscriptQueue({processVideo: async () => ({status: 'done'})});
  for (const limit of [0, -1, 1, 13, 1000, Infinity, NaN, '12', null]) {
    assert.throws(() => queue.start(ids(25), limit), /parallel videos/);
    assert.equal(queue.get(), null);
  }
});

test('fallback mode permits two workers and rejects higher limits or unknown modes', async () => {
  const queue = createTranscriptQueue({processVideo: async () => ({status: 'done'})});
  for (const [limit, mode] of [[3, 'tabs'], [12, 'tabs'], [6, 'unknown']]) assert.throws(() => queue.start(ids(5), limit, mode), /two/);
  queue.start(ids(5), 2, 'tabs');await queue.wait();
  assert.equal(queue.get().mode, 'tabs');assert.equal(queue.get().concurrency, 2);assert.equal(queue.get().done, 5);
});
