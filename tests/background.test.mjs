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
  assert.deepEqual(DEFAULT_SETTINGS, { enabled: true, dwellSeconds: 20, maxAgeDays: 30, perVideo: 2, transcriptConcurrency: 6, speechEnabled: true, scenesEnabled: true,screenTextEnabled:true });
});

test('automatic speech respects the off switches before touching playback', async () => {
  for (const settings of [{enabled:false}, {enabled:true,speechEnabled:false}]) {
    chrome.storage = {local: {get: async () => ({settings})}};
    assert.deepEqual(await request({type:'speech-auto-start'}), {disabled:true});
  }
});

test('speech controls and audio forwarding reject unrelated pages', async () => {
  chrome.storage = {local: {get: async () => ({settings:{enabled:true}})}};
  for (const type of ['speech-start', 'speech-stop']) assert.match((await request({type})).error, /popup/);
  for (const type of ['speech-audio-open', 'speech-audio-close', 'speech-clock', 'speech-pcm', 'speech-auto-start']) {
    assert.match((await request({type})).error, /Invalid/);
  }
});

test('import capture tabs never start automatic speech', async () => {
  chrome.tabs = {get: async () => ({id:1,active:true,url:'https://www.youtube.com/watch?v=aaaaaaaaaaa&recall_index=1'})};
  assert.match((await request({type:'speech-auto-start'}, {id:'x',tab:{id:1},url:'https://www.youtube.com/watch?v=aaaaaaaaaaa&recall_index=1'})).error, /normal YouTube/);
});

test('scene capture respects off switches and validates the sending page',async()=>{
  chrome.storage={local:{get:async()=>({settings:{enabled:true,scenesEnabled:false}})}};
  assert.deepEqual(await request({type:'scene-frame'}),{disabled:true});
  chrome.storage={local:{get:async()=>({settings:{enabled:true,scenesEnabled:true}})}};
  assert.match((await request({type:'scene-frame'})).error,/Invalid scene source/);
  chrome.tabs={get:async()=>({id:1,active:true,url:'https://www.youtube.com/watch?v=aaaaaaaaaaa&recall_index=1'})};
  assert.match((await request({type:'scene-frame'},{id:'x',tab:{id:1},url:'https://www.youtube.com/watch?v=aaaaaaaaaaa&recall_index=1'})).error,/normal YouTube/);
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
test('buffered scene frames require fresh timestamps and the same active playback revision',async()=>{
 chrome.storage={local:{get:async()=>({settings:{enabled:true,scenesEnabled:true}})}};
 const url='https://www.youtube.com/watch?v=aaaaaaaaaaa',sender={id:'x',tab:{id:1},url},clock={video:{videoId:'aaaaaaaaaaa',title:'Trusted metadata'},time:49,revision:2,visible:true};
 chrome.tabs={get:async()=>({active:true,url}),sendMessage:async()=>clock};chrome.runtime.getContexts=async()=>[{}];chrome.runtime.sendMessage=async msg=>msg;
 const frame={type:'scene-frame',video:{videoId:'aaaaaaaaaaa',title:'Page metadata'},start:42,revision:2,capturedAt:Date.now(),adaptive:true};
 for(const patch of [{capturedAt:undefined},{capturedAt:Date.now()-11000},{capturedAt:Date.now()+5000},{revision:1},{start:NaN},{video:{videoId:'bbbbbbbbbbb'}}])assert.deepEqual(await request({...frame,...patch},sender),{inactive:true});
 for(const field of ['paused','seeking','ad']){clock[field]=true;assert.deepEqual(await request(frame,sender),{inactive:true});clock[field]=false;}
 const result=await request(frame,sender);assert.equal(result.type,'scene-index');assert.equal(result.start,42);assert.equal(result.adaptive,true);assert.equal(result.video.title,'Trusted metadata');
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

test('background transcript jobs are controlled only from Library & settings', async () => {
  for (const type of ['transcript-job-start', 'transcript-job-status', 'transcript-job-pause']) {
    assert.match((await request({type, urls: ['aaaaaaaaaaa']}, {id: 'x', url: 'popup/popup.html'})).error, /Library/);
    assert.match((await request({type}, {id: 'x', url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa'})).error, /Library/);
  }
  assert.match((await request({type: 'transcript-job-start', urls: 'not a list'})).error, /video links/);
});

test('interrupted-job cleanup closes only tracked tabs still showing their capture URL', async () => {
  const closed = [];
  chrome.storage.session = {remove: async () => {},get: async () => ({transcriptJob: {
    id: 'interrupted', revision: 2, status: 'running', total: 5, completed: 1, done: 1, failed: 0, skipped: 0, results: [],
    active: [{videoId: 'aaaaaaaaaaa', tabId: 10}, {videoId: 'bbbbbbbbbbb', tabId: 11}, {videoId: 'ccccccccccc', tabId: 12}],
  }})};
  chrome.tabs = {
    get: async id => ({id, url: {
      10: 'https://www.youtube.com/watch?v=aaaaaaaaaaa&recall_index=1',
      11: 'https://www.youtube.com/watch?v=ddddddddddd&recall_index=1',
      12: 'https://www.youtube.com/watch?v=ccccccccccc',
    }[id]}),
    remove: async id => {closed.push(id);},
  };
  const response = await request({type: 'transcript-job-status'});
  assert.deepEqual(closed, [10]);
  assert.equal(response.job.status, 'interrupted');
  assert.equal(response.job.completed, 1);
  assert.deepEqual(response.job.active, []);
});

test('automatic non-English audio is skipped but manual Start can override metadata',async()=>{
 chrome.tabs={get:async()=>({id:1,active:true,url:'https://www.youtube.com/watch?v=aaaaaaaaaaa'}),sendMessage:async()=>({video:{videoId:'aaaaaaaaaaa',audioLanguage:'es'},paused:false,visible:true})};
 const calls=[];chrome.storage.local.get=async()=>({settings:{enabled:true,speechEnabled:true}});chrome.runtime.sendMessage=async msg=>{calls.push(msg.type);return msg.type==='speech-status'?{status:'idle'}:{...msg,id:'manual-test'}};
 const automatic=await request({type:'speech-auto-start'},{id:'x',tab:{id:1},url:'https://www.youtube.com/watch?v=aaaaaaaaaaa'});assert.match(automatic.error,/English audio only/);assert.equal(calls.includes('speech-prepare'),false);
 const manual=await request({type:'speech-start',tabId:1},{id:'x',url:'popup/popup.html'});assert.equal(manual.type,'speech-start');assert.ok(calls.includes('speech-prepare'));
});

test('on-screen text verifies active playback, timing revision and off switches',async()=>{
 chrome.storage={local:{get:async()=>({settings:{enabled:true,screenTextEnabled:false}})}};
 assert.deepEqual(await request({type:'screen-frame'}),{disabled:true});
 chrome.storage={local:{get:async()=>({settings:{enabled:true}})}};
 assert.match((await request({type:'screen-frame'})).error,/Invalid on-screen text source/);
 const url='https://www.youtube.com/watch?v=aaaaaaaaaaa',sender={id:'x',tab:{id:1},url},clock={video:{videoId:'aaaaaaaaaaa'},time:42,revision:1,visible:true};
 chrome.tabs={get:async()=>({active:true,url}),sendMessage:async()=>clock};
 for(const field of ['paused','seeking','ad']){clock[field]=true;assert.deepEqual(await request({type:'screen-frame',video:clock.video,start:42,revision:1},sender),{inactive:true});clock[field]=false;}
 assert.deepEqual(await request({type:'screen-frame',video:clock.video,start:42,revision:0},sender),{inactive:true});
 assert.deepEqual(await request({type:'screen-frame',video:clock.video,start:12,revision:1},sender),{inactive:true});
});
