import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code = readFileSync(new URL('../content/speech-capture.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(reply = () => ({ok: true}), loadModule = async () => {}) {
  const events = new Map(), messages = [];
  let stopped = 0, closed = 0, node;
  const target = {addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name)};
  const track = {stop: () => stopped++};
  const video = {...target, paused: false, captureStream: () => ({getTracks: () => [track], getAudioTracks: () => [track], getVideoTracks: () => []})};
  const context = vm.createContext({Uint8Array, btoa: text => Buffer.from(text, 'binary').toString('base64'), setTimeout,
    chrome: {runtime: {getURL: p => p, sendMessage: async msg => {messages.push(msg);return reply(msg);}}},
    window: target, document: {...target, querySelector: () => video},
    AudioContext: class {audioWorklet = {addModule: loadModule};resume = async () => {};close = async () => {closed++};createMediaStreamSource = () => ({connect() {}, disconnect() {}})},
    AudioWorkletNode: class {constructor() {node = this;}port = {};connect() {}disconnect() {}},
  });
  vm.runInContext(code, context);
  return {api: context.__recallPageAudio, events, messages, counts: () => ({stopped, closed}), packet: () => node.port.onmessage({data: new Int16Array(16000)})};
}
for (const event of ['ended', 'pagehide', 'yt-navigate-start']) test(`${event} stops player audio and notifies the controller`, async () => {
  const f = fixture();await f.api.start('session', () => ({}));
  f.events.get(event)();await tick();
  assert.deepEqual(f.counts(), {stopped: 1, closed: 1});
  assert.equal(f.messages.at(-1).type, 'speech-page-ended');assert.equal(f.messages.at(-1).id, 'session');
  await f.api.stop('session');assert.equal(f.counts().closed, 1);
});
test('a rejected audio packet stops capture instead of continuing to send audio', async () => {
  const f = fixture(msg => msg.type === 'speech-pcm' ? {error: 'Session ended'} : {});
  await f.api.start('session', () => ({}));f.packet();await tick();
  assert.equal(f.counts().closed, 1);assert.equal(f.messages.at(-1).type, 'speech-page-ended');
});
test('a delayed close from an older session cannot stop the current player stream', async () => {
  const f = fixture();await f.api.start('new', () => ({}));await f.api.stop('old');
  assert.equal(f.counts().closed, 0);await f.api.stop('new');assert.equal(f.counts().closed, 1);
});
test('cancelling while the audio module loads cannot open a stream afterward', async () => {
  let resume;const f = fixture(undefined, () => new Promise(resolve => resume = resolve));
  const starting = f.api.start('cancelled', () => ({}));await tick();
  await f.api.stop('cancelled');resume();
  await assert.rejects(starting, /cancelled/);assert.deepEqual(f.counts(), {stopped:1,closed:1});
  assert.equal(f.events.size, 0);
});
