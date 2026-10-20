import { test } from "node:test";
import assert from "node:assert/strict";
import { createQueryCache } from "../lib/query-cache.js";

test('a cold reranker may be retried on a new first-page search without changing existing pagination', async () => {
  let calls = 0;
  const cache = createQueryCache(async () => ({results: [{id: ++calls}, {id: 2}], rerankPending: calls === 1}));
  assert.equal((await cache.get('q', 0, 1, {retryPending: true})).results[0].id, 1);
  assert.equal((await cache.get('q', 0, 1)).results[0].id, 1, 'a pagination first-page probe keeps its original window');
  await cache.get('q', 1, 1); assert.equal(calls, 1);
  assert.equal((await cache.get('q', 0, 1, {retryPending: true})).results[0].id, 2);
  await cache.get('q', 0, 1, {retryPending: true}); assert.equal(calls, 2);
});

test('continuations retain the original window past expiry and additions, while deletion forces fresh results', async () => {
  let time = 0, calls = 0;
  const cache = createQueryCache(async () => ({results: Array.from({length: 40}, (_, i) => ({id: `${calls}:${i}`})), rerankPending: ++calls === 1}), {now: () => time, ttl: 10});
  const first = await cache.get('q', 0, 12, {retryPending: true});
  time = 11; cache.invalidate({destructive: false});
  assert.deepEqual((await cache.get('q', 0, 1, {continuation: true})).results, first.results.slice(0, 1));
  assert.equal((await cache.get('q', 12, 12, {continuation: true})).results[0].id, '0:12');
  assert.equal(calls, 1);
  await cache.get('q', 0, 12, {retryPending: true}); assert.equal(calls, 2, 'a new submitted search may refresh');
  cache.invalidate(); await cache.get('q', 12, 12, {continuation: true}); assert.equal(calls, 3, 'deleted content must not be served from a pinned page');
});
test("arrow pages share one ranked window and deep pages remain reachable", async () => {
  let calls = 0;
  const cache = createQueryCache(async (_key, page) => {
    calls++;
    return { results: Array.from({ length: page.limit }, (_, i) => ({ id: page.offset + i })) };
  });
  assert.equal((await cache.get("q", 0, 2)).results[0].id, 0);
  assert.equal((await cache.get("q", 1, 2)).results[0].id, 1);
  assert.equal(calls, 1);
  assert.equal((await cache.get("q", 5e3, 2)).results[0].id, 5e3);
  assert.equal(calls, 2);
});
test("pending query loads coalesce and invalidation never publishes a stale result", async () => {
  let finish, calls = 0;
  const cache = createQueryCache(async () => {
    calls++;
    if (calls === 1) await new Promise((resolve) => finish = resolve);
    return { results: [{ id: calls }] };
  });
  const a = cache.get("q", 0, 1), b = cache.get("q", 0, 1);
  await new Promise((resolve) => setImmediate(resolve));
  cache.invalidate();
  finish();
  assert.equal((await a).results[0].id, 2);
  assert.equal((await b).results[0].id, 2);
  assert.equal(calls, 2);
});
test("query expiry, bounded LRU size, filters and failures trigger fresh work", async () => {
  let time = 0, calls = 0;
  const cache = createQueryCache(async (key) => {
    calls++;
    if (key === "error") throw Error("broken");
    return { results: [{ key }] };
  }, { now: () => time, ttl: 10, entries: 2 });
  await cache.get("q", 0, 1);
  time = 11;
  await cache.get("q", 0, 1);
  await cache.get("pages", 0, 1);
  await cache.get("videos", 0, 1);
  await cache.get("q", 0, 1);
  assert.equal(calls, 5);
  await assert.rejects(cache.get("error", 0, 1), /broken/);
  await assert.rejects(cache.get("error", 0, 1), /broken/);
  assert.equal(calls, 7);
});
