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
test('incognito YouTube requests stop before any indexing or model access',async()=>{const result=await request({type:'should-index',videoId:'aaaaaaaaaaa'},{id:'x',tab:{id:7,incognito:true},url:'https://www.youtube.com/watch?v=aaaaaaaaaaa'});assert.equal(result.index,false);assert.match(result.reason,/Incognito/);});

test('removed history import and scan messages have no public handler',()=>{
 for(const type of ['history-videos','import-history','web-history','web-import'])assert.equal(onMessage({type},{id:'x',url:'options/options.html'},()=>{throw Error('Removed handler replied');}),false,type);
});

test('default settings match the spec', () => {
  assert.deepEqual(DEFAULT_SETTINGS, { enabled: true, dwellSeconds: 20, maxAgeDays: 28, importMaxAgeDays:0, perVideo: 2, speechEnabled: true, scenesEnabled: true,articleImagesEnabled:true,screenTextEnabled:true,lightMode:false,sceneStorageMB:240 });
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

test('scene capture respects off switches and validates the sending page',async()=>{
  chrome.storage={local:{get:async()=>({settings:{enabled:true,scenesEnabled:false}})}};
  assert.deepEqual(await request({type:'scene-frame'}),{disabled:true});
  chrome.storage={local:{get:async()=>({settings:{enabled:true,scenesEnabled:true}})}};
  assert.match((await request({type:'scene-frame'})).error,/Invalid scene source/);
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
  const distinct = await request({type: 'search', query: 'battery', distinct: true, offset: 12, exclude: ['aaaaaaaaaaa']});
  assert.deepEqual([distinct.perVideo, distinct.limit, distinct.offset, distinct.exclude], [1, 12, 12, ['aaaaaaaaaaa']]);
  for (const offset of [-1, 0.5, '1', NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.match((await request({type: 'search', singleVideo: true, offset})).error, /position/);
    assert.match((await request({type: 'search', distinct: true, offset})).error, /position/);
  }
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
test('excluding YouTube blocks its imports, manual indexing and live scene saves',async()=>{
 chrome.storage.local.get=async()=>({settings:{enabled:true},webCapture:{blocked:['youtube.com']}});
 assert.deepEqual(await request({type:'should-index',videoId:'aaaaaaaaaaa',manual:true}),{index:false,reason:'YouTube is excluded.'});
 for(const message of [{type:'index-video',video:{videoId:'aaaaaaaaaaa'},segments:[]}])assert.match((await request(message)).error,/excluded/i);
 assert.deepEqual(await request({type:'scene-frame'},{id:'x',tab:{id:1},url:'https://www.youtube.com/watch?v=aaaaaaaaaaa'}),{disabled:true});
 assert.deepEqual(await request({type:'speech-pcm',id:'excluded',pcm:[0],clock:{}},{id:'x',tab:{id:1},url:'https://www.youtube.com/watch?v=aaaaaaaaaaa'}),{disabled:true});
});

test('paused caption and metadata saves stop before reaching the engine',async()=>{
  chrome.storage.local.get=async()=>({settings:{enabled:false}});
  const calls=[];chrome.runtime.sendMessage=async msg=>{calls.push(msg);return {};};
  const sender={id:'x',tab:{id:1},frameId:0,url:'https://www.youtube.com/watch?v=aaaaaaaaaaa'};
  for(const manual of [false,true])assert.deepEqual(await request({type:'should-index',videoId:'aaaaaaaaaaa',watchedAt:Date.now(),manual},sender),{index:false,reason:'Indexing is paused'});
  for(const type of ['index-video','index-metadata'])assert.match((await request({type,video:{videoId:'aaaaaaaaaaa'},segments:[]},sender)).error,/paused/);
  assert.equal(calls.length,0);
});

test('only the offscreen engine can check the final YouTube saving gate',async()=>{
  assert.match((await request({type:'youtube-saving-status'})).error,/Invalid capture status/);
  const sender={id:'x',url:'offscreen/offscreen.html'};
  for(const [settings,webCapture,allowed] of [[{enabled:true},{},true],[{enabled:false},{},false],[{enabled:true},{blocked:['youtube.com']},false]]){
    chrome.storage.local.get=async()=>({settings,webCapture});
    assert.deepEqual(await request({type:'youtube-saving-status'},sender),{allowed});
  }
});

test('caption saves require the current top-level YouTube video',async()=>{
  chrome.storage.local.get=async()=>({settings:{enabled:true}});
  const url='https://www.youtube.com/watch?v=aaaaaaaaaaa',sender={id:'x',tab:{id:1},frameId:0,url};
  let tab={id:1,url};chrome.tabs.get=async()=>tab;
  const calls=[];chrome.runtime.sendMessage=async msg=>{calls.push(msg);return {chunkCount:1};};
  chrome.action={setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{},setTitle:async()=>{}};
  for(const type of ['index-video','index-metadata']){
    const msg={type,video:{videoId:'aaaaaaaaaaa'},segments:[]};
    for(const patch of [{url:'https://example.com/watch?v=aaaaaaaaaaa'},{url:undefined},{tab:undefined},{frameId:1}])assert.match((await request(msg,{...sender,...patch})).error,/Invalid video capture source/);
    for(const changed of [{url:'https://www.youtube.com/watch?v=bbbbbbbbbbb'},{url,incognito:true}]){tab=changed;assert.match((await request(msg,sender)).error,/video changed/);}
  }
  assert.equal(calls.length,0);
  tab={id:1,url};assert.equal((await request({type:'index-video',video:{videoId:'aaaaaaaaaaa'},segments:[]},sender)).chunkCount,1);
  assert.equal(calls.filter(msg=>msg.type==='index').length,1);
});

test('website scripts cannot read or mutate the library or start UI work',async()=>{
  const calls=[];chrome.runtime.sendMessage=async msg=>{calls.push(msg);return {status:'idle'};};
  const commands=['list','delete','clear','export','import','prune','search','status','warmup','index-tab','vision-status','speech-status'];
  for(const url of ['https://example.com/','popup/fake.html','options/options.html/extra'])for(const type of commands){
    const result=await request({type,data:{format:'recall-export',videos:[]}},{id:'x',tab:{id:1},url});
    assert.match(result.error,/CueWoven|Library/);
  }
  assert.equal(calls.length,0,'denied commands never reach the engine');
  for(const type of ['toString','constructor','__proto__'])assert.equal(onMessage({type},{id:'x'},()=>assert.fail('inherited handler replied')),false);
  assert.equal(onMessage({type:'export'},{id:'other',url:'options/options.html'},()=>assert.fail('foreign extension replied')),false);
});
test('Library tabs retain backup and data controls while popup retains search',async()=>{
  chrome.storage.local.get=async()=>({settings:{enabled:true}});
  chrome.runtime.getContexts=async()=>[{}];
  chrome.runtime.sendMessage=async msg=>msg.type==='speech-status'?{status:'idle'}:msg;
  for(const type of ['list','export','import','delete','prune']){
    const result=await request({type,data:{format:'recall-export',videos:[]},videoId:'aaaaaaaaaaa'},{id:'x',url:'options/options.html#sec-data',tab:{id:5}});
    assert.equal(result.type,type);
    assert.match((await request({type},{id:'x',url:'popup/popup.html'})).error,/Library/);
  }
  assert.equal((await request({type:'search',query:'coral'},{id:'x',url:'popup/popup.html'})).type,'search');
});

test('automatic speech accepts undetermined language while retaining the English-only model',async()=>{
 chrome.storage.local.get=async()=>({settings:{enabled:true,speechEnabled:true}});
 chrome.tabs={get:async()=>({id:1,active:true,url:'https://www.youtube.com/watch?v=aaaaaaaaaaa'}),sendMessage:async()=>({video:{videoId:'aaaaaaaaaaa',audioLanguage:'und'},paused:false,visible:true})};
 const calls=[];chrome.runtime.getContexts=async()=>[{}];chrome.runtime.sendMessage=async msg=>{calls.push(msg.type);return msg.type==='speech-status'?{status:'idle'}:{...msg,id:'automatic-unknown'};};
 const result=await request({type:'speech-auto-start'},{id:'x',tab:{id:1},url:'https://www.youtube.com/watch?v=aaaaaaaaaaa'});
 assert.equal(result.type,'speech-start');assert.ok(calls.includes('speech-prepare'));
});
