import { test } from 'node:test';
import assert from 'node:assert/strict';

// Minimal chrome.* stub so the service worker module can be imported in Node.
const listener = () => ({ addListener() {} });
let onMessage;
globalThis.chrome = {
  runtime: { onMessage: { addListener(fn) { onMessage = fn; } }, onInstalled: listener(), id: 'x', getURL: (p) => p },
  alarms: { onAlarm: listener() },
};
const { videoIdFromUrl, DEFAULT_SETTINGS } = await import('../background.js');

test('videoIdFromUrl understands common YouTube link shapes', () => {
  assert.equal(videoIdFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s'), 'dQw4w9WgXcQ');
  assert.equal(videoIdFromUrl('https://youtu.be/dQw4w9WgXcQ?si=abc'), 'dQw4w9WgXcQ');
  assert.equal(videoIdFromUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(videoIdFromUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(videoIdFromUrl('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(videoIdFromUrl('https://example.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(videoIdFromUrl('not a link'), null);
});

const request = (msg, sender = { id: 'x', tab: { id: 1 }, url: 'options/options.html' }) =>
  new Promise(resolve => assert.equal(onMessage(msg, sender, resolve), true));

test('history scanning requires the library page, permission and a valid range', async () => {
  let reads = 0;
  chrome.history = { search: async () => { reads++; return []; } };
  chrome.permissions = { contains: async () => false };
  assert.match((await request({ type: 'history-videos', days: 90 })).error, /Allow history/);
  assert.match((await request({ type: 'history-videos', days: -1 })).error, /valid history range/);
  assert.match((await request({ type: 'history-videos' }, { id: 'x', tab: { id: 1 }, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })).error, /Library/);
  assert.match((await request({ type: 'history-videos' }, { id: 'x', url: 'popup/popup.html' })).error, /Library/);
  assert.equal(reads, 0);
});

test('history scanning filters URL hosts and merges duplicate visits without returning unrelated data', async () => {
  const queries = [];
  chrome.permissions = { contains: async () => true };
  chrome.history = { search: async query => {
    queries.push(query);
    return query.text === 'youtube.com' ? [
      {url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title:'A video - YouTube',lastVisitTime:10, extra:'private'},
      {url:'https://example.com/?youtube.com',title:'Not YouTube',lastVisitTime:20},
    ] : [{url:'https://youtu.be/dQw4w9WgXcQ',title:'Latest title - YouTube',lastVisitTime:30}];
  } };
  const result = await request({type:'history-videos',days:0});
  assert.deepEqual(result, {videos:[{videoId:'dQw4w9WgXcQ',title:'Latest title',lastVisitTime:30}],limited:false});
  assert.deepEqual(queries.map(q=>q.startTime),[0,0]);
  assert.ok(queries.every(q=>q.maxResults===10000));
});

test('default settings match the spec', () => {
  assert.deepEqual(DEFAULT_SETTINGS, { enabled: true, dwellSeconds: 20, maxAgeDays: 30, perVideo: 2 });
});

test('videoIdFromUrl rejects malformed IDs, extra path data and unsupported schemes', () => {
  for (const url of [
    'https://youtu.be/short', 'https://youtu.be/dQw4w9WgXcQextra',
    'https://www.youtube.com/watch?v=bad%26recall_index%3D1',
    'https://www.youtube.com/shorts/dQw4w9WgXcQextra',
    'ftp://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/not-a-video?v=dQw4w9WgXcQ',
  ]) assert.equal(videoIdFromUrl(url), null, url);
});

test('single-video searches use unique video pages while list searches retain their settings', async () => {
  chrome.storage = {local: {get: async () => ({settings: {perVideo: 5}})}};
  chrome.runtime.getContexts = async () => [{}];
  chrome.runtime.sendMessage = async message => message;
  const list = await request({type: 'search', query: 'battery', sinceDays: 7});
  assert.equal(list.perVideo, 5);
  assert.equal(list.limit, 12);
  const page = await request({type: 'search', query: 'battery', sinceDays: 7, singleVideo: true, offset: 13});
  assert.equal(page.perVideo, 1);
  assert.equal(page.limit, 2);
  assert.equal(page.offset, 13);
  assert.equal(page.sinceDays, 7);
  assert.equal((await request({type: 'search', singleVideo: true})).offset, 0);
  for (const offset of [-1, 0.5, '1', NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.match((await request({type: 'search', singleVideo: true, offset})).error, /position/);
  }
});
