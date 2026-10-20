import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDeviceSettings} from '../lib/device-settings.js';

function fixture(capacity = 8 * 1024 ** 3, stored = {}) {
 const data = structuredClone(stored), calls = {reads:0, writes:0, memory:0};
 const storage = {
  get:async () => {calls.reads++; return structuredClone(data);},
  set:async patch => {calls.writes++; Object.assign(data, structuredClone(patch));},
 };
 const memory = {getInfo:async () => {calls.memory++; return {capacity, availableCapacity:1};}};
 return {data, calls, storage, memory, initialize:() => createDeviceSettings({storage, memory})};
}

test('fresh low-memory setup coalesces concurrent callers and enables Lite without disabling text saving', async () => {
 const f = fixture(), initialize = f.initialize();
 const defaults = await Promise.all([initialize(), initialize(), initialize()]);
 assert.ok(defaults.every(value => value.lightMode));
 assert.equal(f.data.settings.lightMode, true);
 assert.equal(f.data.settings.enabled, true);
 assert.equal(f.data.settings.dwellSeconds, 10);
 assert.equal(f.data.liteModeInitialized, true);
 assert.deepEqual(f.calls, {reads:1, writes:1, memory:1});
});

test('first update applies Lite on low memory while keeping capture preferences and other storage', async () => {
 const settings = {lightMode:false, enabled:false, speechEnabled:false, scenesEnabled:true, maxAgeDays:7, sceneStorageMB:64, dwellSeconds:30};
 const f = fixture(8 * 1024 ** 3, {settings, webCapture:{domains:['example.com']}, other:'keep'});
 await f.initialize()();
 assert.deepEqual(f.data.settings, {...f.data.settings, ...settings, lightMode:true});
 assert.equal(f.data.other, 'keep');
 assert.deepEqual(f.data.webCapture, {domains:['example.com']});
});

test('manual off choice survives new worker instances and future updates', async () => {
 const f = fixture();
 await f.initialize()();
 f.data.settings.lightMode = false;
 const defaults = await f.initialize()();
 assert.equal(defaults.lightMode, true);
 assert.equal(f.data.settings.lightMode, false);
 assert.equal(f.calls.writes, 1);
});

test('larger devices use full capture even when free memory is low, and preserve existing Lite choice', async () => {
 for (const lightMode of [undefined, true, false]) {
  const f = fixture(16 * 1024 ** 3, {settings:lightMode === undefined ? {} : {lightMode}});
  assert.equal((await f.initialize()()).lightMode, false);
  assert.equal(f.data.settings.lightMode, lightMode === true);
 }
});

test('unknown, failed or invalid memory detection keeps existing choice and retries on a later worker', async () => {
 for (const capacity of [undefined, NaN, 0, -1]) {
  const f = fixture(capacity, {settings:{lightMode:true}});
  // The fixture default argument supplies 8 GiB for undefined; override it here.
  f.memory.getInfo = async () => ({capacity});
  await f.initialize()();
  assert.equal(f.data.settings.lightMode, true);
  assert.equal(f.data.liteModeInitialized, false);
  f.memory.getInfo = async () => ({capacity:8 * 1024 ** 3});
  await f.initialize()();
  assert.equal(f.data.liteModeInitialized, true);
 }
 for (const memory of [undefined, {getInfo:async () => {throw Error('Unavailable');}}]) {
  const f = fixture();
  assert.equal((await createDeviceSettings({storage:f.storage, memory})()).lightMode, false);
  assert.equal(f.data.settings.lightMode, false);
  assert.equal(f.data.liteModeInitialized, false);
 }
});

test('settings changed while the hardware query runs are read before applying the default', async () => {
 const f = fixture(), initialize = f.initialize();
 let finish;
 f.memory.getInfo = () => new Promise(resolve => {finish = resolve;});
 const pending = initialize();
 f.data.settings = {lightMode:false, enabled:false, maxAgeDays:90};
 f.data.liteModeInitialized = true; // An explicit user choice wins.
 finish({capacity:8 * 1024 ** 3});
 await pending;
 assert.deepEqual(f.data.settings, {lightMode:false, enabled:false, maxAgeDays:90});
 assert.equal(f.calls.writes, 0);
});

test('storage failure is reported and initialization can be retried', async () => {
 const f = fixture(), original = f.storage.set;
 f.storage.set = async () => {throw Error('Storage failure');};
 const initialize = f.initialize();
 await assert.rejects(initialize(), /Storage failure/);
 f.storage.set = original;
 await initialize();
 assert.equal(f.data.settings.lightMode, true);
});
