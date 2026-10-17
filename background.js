// Service worker: routes messages between YouTube tabs, the popup/library pages
// and the offscreen document that holds the model and the index.
import { historyVideos } from './lib/history.js';
import { videoIdFromUrl } from './lib/video.js';
import { createCaptureWindow } from './lib/capture-window.js';
import { createTranscriptQueue } from './lib/transcript-queue.js';
import './lib/scene-policy.js';
import {createWebAccess} from './lib/web-access.js';
import {policy} from './lib/web-items.js';
export { videoIdFromUrl } from './lib/video.js';

const OFFSCREEN_PATH = 'offscreen/offscreen.html';
export const DEFAULT_SETTINGS = { enabled: true, dwellSeconds: 20, maxAgeDays: 30, perVideo: 2, transcriptConcurrency: 6, speechEnabled: true, scenesEnabled: true, screenTextEnabled:true };

// ---------------------------------------------------------------------------
// Offscreen document
// ---------------------------------------------------------------------------
let creating = null;

async function ensureOffscreen() {
  const url = chrome.runtime.getURL(OFFSCREEN_PATH);
  const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] });
  if (existing.length) return;
  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_PATH,
        reasons: ['WORKERS'],
        justification: 'Runs local search and automatic player-audio transcription when captions are unavailable.',
      })
      .catch((e) => {
        if (!/single offscreen/i.test(String(e && e.message))) throw e;
      })
      .finally(() => { creating = null; });
  }
  await creating;
}

async function engine(type, payload = {}) {
  await ensureOffscreen();
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await chrome.runtime.sendMessage(Object.assign({}, payload, { type, target: 'offscreen' }));
      if (res === undefined) throw new Error('Receiving end does not exist');
      if (res && res.error) throw new Error(res.error);
      return res;
    } catch (e) {
      lastErr = e;
      if (!/Receiving end does not exist|message port closed/i.test(String(e && e.message))) throw e;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1))); // document still loading
    }
  }
  throw lastErr;
}

async function getSettings() {
  const { settings,webCapture } = await chrome.storage.local.get(['settings','webCapture']);
  return Object.assign({}, DEFAULT_SETTINGS, settings,{youtubeBlocked:policy.matches('www.youtube.com',webCapture?.blocked||[])||policy.matches('youtu.be',webCapture?.blocked||[])});
}

// ---------------------------------------------------------------------------
// Toolbar badge feedback
// ---------------------------------------------------------------------------
let speechBadgeTab = null;
function flashBadge(tabId, text, color) {
  if (tabId === speechBadgeTab) return;
  if (tabId == null) return;
  chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(() => {});
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  setTimeout(() => {if (tabId !== speechBadgeTab) chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});}, 4000);
}

// ---------------------------------------------------------------------------
// Bulk pre-loading (the demo "insurance policy")
// ---------------------------------------------------------------------------
const waiters = new Map(); // tabId -> resolve({ok, reason})

const captureWindow = createCaptureWindow(chrome);
const captureTabs = new Map();

async function fetchVideoTranscript(id, onTab = () => {}) {
  const existing=await engine('has',{videoId:id});
  if (existing.has) return {videoId:id,title:existing.title,status:'skipped',reason:'Already indexed'};
  const windowId = await captureWindow.get();
  const tab = await chrome.tabs.create({windowId, url: `https://www.youtube.com/watch?v=${id}&recall_index=1`, active: false});
  captureTabs.set(tab.id, windowId);
  // Register immediately, before awaiting storage or mute operations.
  const outcome = new Promise(resolve => {
    const timer = setTimeout(() => { waiters.delete(tab.id); resolve({ok: false, reason: 'Timed out'}); }, 75000);
    waiters.set(tab.id, r => { clearTimeout(timer); waiters.delete(tab.id); resolve(r); });
  });
  try {
    onTab(tab.id);
    await chrome.tabs.update(tab.id, {muted: true});
    await captureWindow.minimize(windowId);
    const result = await outcome;
    return {...result,title:result.title || existing.title,videoId: id, status: result.ok ? 'done' : 'failed'};
  } finally {
    captureTabs.delete(tab.id);
    settleWaiter(tab.id, {ok: false, reason: 'Transcript tab closed'});
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

let jobsReady;
let jobKeepAlive;
function getTranscriptJobs() {
  if (!jobsReady) jobsReady = (async () => {
    const {transcriptJob} = await chrome.storage.session.get('transcriptJob');
    if (transcriptJob && ['running', 'pausing'].includes(transcriptJob.status)) {
      for (const active of transcriptJob.active || []) {
        if (!Number.isInteger(active.tabId)) continue;
        const tab = await chrome.tabs.get(active.tabId).catch(() => null);
        if (tab?.url && videoIdFromUrl(tab.url) === active.videoId && new URL(tab.url).searchParams.get('recall_index') === '1') await chrome.tabs.remove(tab.id).catch(() => {});
      }
    }
    await captureWindow.recover();
    const jobs = createTranscriptQueue({
      initial: transcriptJob,
      processVideo: fetchVideoTranscript,
      beforeStart: async () => {captureWindow.begin();await engine('warmup');},
      afterFinish: () => captureWindow.close(),
      onChange(job) {
        if (['running', 'pausing'].includes(job.status)) {
          if (!jobKeepAlive) jobKeepAlive = setInterval(() => chrome.runtime.getPlatformInfo().catch(() => {}), 20000);
        } else { clearInterval(jobKeepAlive); jobKeepAlive = null; }
        chrome.runtime.sendMessage({type: 'transcript-job', job}).catch(() => {});
        return chrome.storage.session.set({transcriptJob: job});
      },
    });
    return jobs;
  })();
  return jobsReady;
}

function requireLibrary(sender) {
  if (sender.url?.split('#')[0] !== chrome.runtime.getURL('options/options.html')) throw new Error('Open Library & settings to manage transcript fetching.');
}

async function requireTranscriptJobIdle() {
  if (['preparing', 'recording', 'stopping'].includes((await engine('speech-status')).status)) throw new Error('Stop speech-to-text before changing saved data.');
  if (['running', 'pausing'].includes((await getTranscriptJobs()).get()?.status)) throw new Error('Pause transcript fetching before changing saved data.');
}

function settleWaiter(tabId, outcome) {
  const w = tabId != null && waiters.get(tabId);
  if (w) w(outcome);
}

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------

function requirePopup(sender) {
  if (sender.url?.split('#')[0] !== chrome.runtime.getURL('popup/popup.html')) throw new Error('Use the Recall popup to control speech-to-text.');
}
async function speechContext(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if(!tab.url?.startsWith('https://www.youtube.com/watch?'))return webAccess.context(tabId);
  if((await getSettings()).youtubeBlocked)throw Error('YouTube is excluded in website settings. Allow youtube.com to resume.');
  const id = videoIdFromUrl(tab.url);
  if (!id || !tab.url.startsWith('https://www.youtube.com/watch?') || new URL(tab.url).searchParams.get('recall_index') === '1') throw new Error('Open a normal YouTube video first.');
  const clock = await chrome.tabs.sendMessage(tabId, {type: 'speech-context'});
  if (clock?.video?.videoId !== id || clock.forced) throw new Error('Refresh the YouTube tab so Recall can read its playback timing.');
  return {tab, clock};
}


async function startSpeech(tabId, manual=false) {
  if (!Number.isInteger(tabId)) throw new Error('Invalid video tab.');
  const {tab, clock} = await speechContext(tabId);
  if (!manual && clock.video.audioLanguage && !/^en(?:-|$)/i.test(clock.video.audioLanguage)) throw new Error('Automatic speech-to-text supports English audio only. Captions and scenes remain available.');
  if (!tab.active || clock.paused || !clock.visible) throw new Error('Play a video in the active tab first.');
  const ready = await engine('speech-prepare', {tabId, video: clock.video});
  try {
    const latest = await speechContext(tabId);
    if (latest.clock.video.videoId !== ready.video.videoId) throw new Error('The video changed while loading the speech model.');
    return await engine('speech-start', {id: ready.id});
  } catch (error) {
    if ((await engine('speech-status')).id === ready.id) await engine('speech-stop', {reason: error.message});
    throw error;
  }
}

const handlers = {
  async 'screen-frame'(input,sender){
    const settings=await getSettings();if(!settings.enabled || settings.screenTextEnabled===false)return {disabled:true};
    if(settings.youtubeBlocked&&sender.url?.startsWith('https://www.youtube.com/'))return {disabled:true};
    if(!sender.tab || !sender.url?.startsWith('https://www.youtube.com/watch?')&&!policy.safeUrl(sender.url))throw Error('Invalid on-screen text source.');
    const {tab,clock}=await speechContext(sender.tab.id);
    if(!tab.active || !clock.visible || clock.paused || clock.seeking || clock.ad || clock.video.videoId!==input.video?.videoId || clock.revision!==input.revision || !Number.isFinite(input.start) || Math.abs(clock.time-input.start)>3)return {inactive:true};
    return engine('screen-index',{video:clock.video,start:input.start,image:input.image});
  },
  async 'screen-capture-error'({reason},sender){
    if(!sender.tab || !sender.url?.startsWith('https://www.youtube.com/watch?')&&!policy.safeUrl(sender.url))throw Error('Invalid on-screen text source.');
    chrome.runtime.sendMessage({type:'ocr-state',state:{status:'error',error:String(reason).slice(0,300)}}).catch(()=>{});return {ok:true};
  },
  async 'scene-frame'(input,sender) {
    const settings=await getSettings();if (!settings.enabled || settings.scenesEnabled === false) return {disabled:true};
    if(settings.youtubeBlocked&&sender.url?.startsWith('https://www.youtube.com/'))return {disabled:true};
    if (!sender.tab || !sender.url?.startsWith('https://www.youtube.com/watch?')&&!policy.safeUrl(sender.url)) throw new Error('Invalid scene source.');
    const {tab,clock}=await speechContext(sender.tab.id);
    const age=Date.now()-input.capturedAt;
    if (!tab.active || !clock.visible || clock.paused || clock.seeking || clock.ad || clock.video.videoId!==input.video?.videoId || clock.revision!==input.revision || !Number.isFinite(input.start) || !Number.isFinite(input.capturedAt) || age< -1000 || age>=globalThis.__recallScenePolicy.MAX_AGE_MS)return {inactive:true};
    return engine('scene-index',{video:clock.video,start:input.start,image:input.image,adaptive:input.adaptive===true});
  },
  async 'scene-capture-error'({reason},sender) {
    if (!sender.tab || !sender.url?.startsWith('https://www.youtube.com/watch?')&&!policy.safeUrl(sender.url)) throw new Error('Invalid scene source.');
    chrome.runtime.sendMessage({type:'vision-state',state:{status:'error',error:String(reason).slice(0,300)}}).catch(()=>{});return {ok:true};
  },
  'vision-status':()=>engine('vision-status'),
  async 'speech-start'({tabId}, sender) {requirePopup(sender);return startSpeech(tabId,true);},
  async 'speech-auto-start'(_msg, sender) {
    const settings = await getSettings();
    if (!settings.enabled || settings.speechEnabled === false) return {disabled: true};
    if (!sender.tab || !sender.url?.startsWith('https://www.youtube.com/watch?')&&!policy.safeUrl(sender.url)) throw new Error('Invalid automatic speech request.');
    if(!sender.url.startsWith('https://www.youtube.com/watch?')&&!(await webAccess.config()).audio)return {disabled:true};
    const {clock} = await speechContext(sender.tab.id);
    if (!clock.visible || clock.paused || clock.ad) return {inactive: true};
    const state = await engine('speech-status');
    if (state.status !== 'idle') {
      if (state.tabId === sender.tab.id) return state;
      await engine('speech-stop', {reason: 'Switched to a different watched video.'});
    }
    return startSpeech(sender.tab.id);
  },
  async 'speech-pcm'({id, pcm, clock}, sender) {
    if (!sender.tab || !sender.url?.startsWith('https://www.youtube.com/watch?')&&!policy.safeUrl(sender.url)) throw new Error('Invalid speech audio source.');
    if(!sender.url.startsWith('https://www.youtube.com/watch?')){const {clock:current}=await webAccess.context(sender.tab.id);if(current.video.videoId!==clock?.video?.videoId)return {ignored:true};}
    return engine('speech-pcm', {id, tabId: sender.tab.id, pcm, clock});
  },
  async 'speech-page-ended'({id}, sender) {
    const state = await engine('speech-status');
    if (state.id === id && state.tabId === sender.tab?.id) return engine('speech-stop', {reason: 'The video ended or changed.'});
    return {ignored: true};
  },
  async 'speech-audio-open'({tabId, id}, sender) {
    if (sender.url !== chrome.runtime.getURL(OFFSCREEN_PATH)) throw new Error('Invalid audio capture request.');
    return chrome.tabs.sendMessage(tabId, {type: 'speech-audio-open', id});
  },
  async 'speech-audio-close'({tabId, id}, sender) {
    if (sender.url !== chrome.runtime.getURL(OFFSCREEN_PATH)) throw new Error('Invalid audio capture request.');
    return chrome.tabs.sendMessage(tabId, {type: 'speech-audio-close', id}).catch(() => ({ok: true}));
  },
  async 'speech-stop'(_data, sender) {requirePopup(sender);return engine('speech-stop');},
  async 'speech-status'() {return engine('speech-status');},
  async 'speech-clock'({tabId}, sender) {
    if (sender.url !== chrome.runtime.getURL(OFFSCREEN_PATH)) throw new Error('Invalid audio timing request.');
    return (await speechContext(tabId)).clock;
  },
  async 'transcript-job-start'({urls}, sender) {
    requireLibrary(sender);
    if((await getSettings()).youtubeBlocked)throw Error('YouTube is excluded. Allow youtube.com before fetching captions.');
    if (!Array.isArray(urls)) throw new Error('Provide video links to fetch.');
    const ids = urls.map(videoIdFromUrl).filter(Boolean);
    const settings = await getSettings();
    const concurrency = [3, 6].includes(settings.transcriptConcurrency) ? settings.transcriptConcurrency : 6;
    return {job: (await getTranscriptJobs()).start(ids, concurrency)};
  },
  async 'transcript-job-status'(_msg, sender) {
    requireLibrary(sender);
    return {job: (await getTranscriptJobs()).get()};
  },
  async 'transcript-job-pause'(_msg, sender) {
    requireLibrary(sender);
    return {job: (await getTranscriptJobs()).pause()};
  },
  async 'import-history'({ videos }, sender) {
    if (sender.url?.split('#')[0] !== chrome.runtime.getURL('options/options.html')) throw new Error('Open Library & settings to import history.');
    if((await getSettings()).youtubeBlocked)throw Error('YouTube is excluded. Allow youtube.com before importing its history.');
    const result = await engine('import-history', { videos });
    chrome.runtime.sendMessage({ type: 'index-changed' }).catch(() => {});
    return result;
  },
  async 'history-videos'({ days = 90 }, sender) {
    if (sender.url?.split('#')[0] !== chrome.runtime.getURL('options/options.html')) {
      throw new Error('Open Library & settings to scan history.');
    }
    if (![0, 30, 90, 365].includes(days)) throw new Error('Choose a valid history range.');
    if (!await chrome.permissions.contains({ permissions: ['history'] })) {
      throw new Error('Allow history access using Find YouTube history first.');
    }
    const startTime = days ? Date.now() - days * 864e5 : 0;
    const groups = await Promise.all(['youtube.com', 'youtu.be'].map(text =>
      chrome.history.search({ text, startTime, maxResults: 10000 })
    ));
    const candidates = historyVideos(groups.flat(), videoIdFromUrl);
    return { videos: candidates, limited: candidates.length === 500 || groups.some(g => g.length === 10000) };
  },
  // From YouTube tabs
  async 'should-index'({ videoId, manual, watchedAt },sender) {
    const s = await getSettings();
    if(s.youtubeBlocked){settleWaiter(sender?.tab?.id,{ok:false,reason:'YouTube is excluded.'});return {index:false,reason:'YouTube is excluded.'};}
    if (!manual && !s.enabled) return { index: false, reason: 'Indexing is paused' };
    if (Number.isFinite(watchedAt) && watchedAt > 0 && watchedAt <= Date.now() + 60000) {
      await engine('touch-watch', { videoId, watchedAt });
    }
    if (manual) return { index: true };
    const { has } = await engine('has', { videoId });
    return { index: !has, reason: has ? 'Already indexed' : undefined };
  },
  async 'index-video'({ video, segments, method }, sender) {
    try {
      if((await getSettings()).youtubeBlocked)throw Error('YouTube is excluded.');
      const res = await engine('index', { video, segments, method });
      flashBadge(sender.tab && sender.tab.id, '✓', '#1f8a4c');
      settleWaiter(sender.tab && sender.tab.id, { ok: true, chunkCount: res.chunkCount, title: res.video.title });
      chrome.runtime.sendMessage({ type: 'index-changed' }).catch(() => {});
      return { chunkCount: res.chunkCount };
    } catch (e) {
      settleWaiter(sender.tab && sender.tab.id, { ok: false, title:String(video?.title||'').slice(0,300),reason: String(e.message || e) });
      throw e;
    }
  },
  async 'index-failed'({ reason,title }, sender) {
    flashBadge(sender.tab && sender.tab.id, '!', '#b3261e');
    settleWaiter(sender.tab && sender.tab.id, { ok: false,title:String(title||'').slice(0,300), reason });
    return { ok: true };
  },

  // From the popup / library page
  async search({ query, sinceDays, singleVideo, offset = 0,kind }) {
    const s = await getSettings();
    if (singleVideo === true) {
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid search position.');
      return engine('search', { query, sinceDays, perVideo: 1, limit: 2, offset,...(kind?{kind}:{}) });
    }
    return engine('search', { query, sinceDays, perVideo: s.perVideo, limit: 12,...(kind?{kind}:{}) });
  },
  status: () => engine('status'),
  warmup: ({scenes}) => engine('warmup',{scenes:scenes===true}),
  list: () => engine('list'),
  async delete({ videoId }) {
    await requireTranscriptJobIdle();
    const r = await engine('delete', { videoId });
    chrome.runtime.sendMessage({ type: 'index-changed' }).catch(() => {});
    return r;
  },
  async clear() {
    await requireTranscriptJobIdle();
    const r = await engine('clear');
    chrome.runtime.sendMessage({ type: 'index-changed' }).catch(() => {});
    return r;
  },
  export: () => engine('export'),
  async import({ data }) {
    await requireTranscriptJobIdle();
    const r = await engine('import', { data });
    chrome.runtime.sendMessage({ type: 'index-changed' }).catch(() => {});
    return r;
  },
  async 'index-tab'({ tabId }) {
    try {
      return await chrome.tabs.sendMessage(tabId, { type: 'index-now' });
    } catch (_) {
      return { ok: false, reason: 'Refresh this tab after enabling its site in Library & settings, then try again.' };
    }
  },
  prune: async () => engine('prune', { maxAgeDays: (await getSettings()).maxAgeDays }),
};
const webAccess=createWebAccess({chrome,engine,getSettings,requireLibrary,beforeForget:async site=>{if(policy.matches('www.youtube.com',[site])||policy.matches('youtu.be',[site]))(await getTranscriptJobs()).pause();}});
Object.assign(handlers,webAccess.handlers);
chrome.permissions?.onAdded?.addListener(()=>webAccess.sync().catch(()=>{}));
chrome.permissions?.onRemoved?.addListener(async removed=>{if(removed.origins?.length||removed.permissions?.includes('scripting')){const settings=await webAccess.config();await chrome.storage.local.set({webCapture:{...settings,paused:true}});}webAccess.sync().catch(()=>{});});
chrome.runtime.onStartup?.addListener(()=>webAccess.sync().catch(()=>{}));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target === 'offscreen') return false;
  if (sender.id !== chrome.runtime.id) return false;
  if (msg.type === 'speech-state' && sender.url === chrome.runtime.getURL(OFFSCREEN_PATH)) {
    const active = ['preparing', 'recording', 'stopping'].includes(msg.state.status);
    if (speechBadgeTab !== null && (!active || speechBadgeTab !== msg.state.tabId)) chrome.action.setBadgeText({tabId: speechBadgeTab, text: ''}).catch(() => {});
    speechBadgeTab = active ? msg.state.tabId : null;
    if (speechBadgeTab !== null) {
      chrome.action.setBadgeBackgroundColor({tabId: speechBadgeTab, color: '#2563eb'}).catch(() => {});
      chrome.action.setBadgeText({tabId: speechBadgeTab, text: msg.state.status === 'recording' ? 'STT' : '…'}).catch(() => {});
    }
    return false;
  }
  const fn = handlers[msg.type];
  if (!fn) return false; // e.g. broadcasts from the offscreen document
  Promise.resolve()
    .then(() => fn(msg, sender))
    .then((r) => sendResponse(r))
    .catch((e) => sendResponse({ error: String((e && e.message) || e) }));
  return true;
});

// ---------------------------------------------------------------------------
// Housekeeping: daily auto-delete of old entries
// ---------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await webAccess.sync().catch(()=>{});
  const { settings } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: Object.assign({}, DEFAULT_SETTINGS, settings) });
  chrome.alarms.create('recall-prune', { periodInMinutes: 24 * 60, delayInMinutes: 1 });
  if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#welcome') });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'recall-prune') handlers.prune().catch(() => {});
});

// Manual closure pauses the job rather than repeatedly recreating a window.
function onCaptureWindowRemoved(windowId) {
  if (!captureWindow.removed(windowId)) return;
  if (jobsReady) jobsReady.then(jobs => jobs.pause()).catch(() => {});
  for (const [tabId, owner] of captureTabs) if (owner === windowId) settleWaiter(tabId, {ok: false, reason: 'Capture window closed'});
}
chrome.windows?.onRemoved?.addListener(onCaptureWindowRemoved);
chrome.tabs?.onRemoved?.addListener((tabId, info) => {
  if (tabId === speechBadgeTab) engine('speech-stop', {reason: 'The video tab was closed.'}).catch(() => {});
  if (info?.isWindowClosing && captureTabs.has(tabId)) onCaptureWindowRemoved(info.windowId);
  settleWaiter(tabId, {ok: false, reason: 'Capture tab closed'});
});


chrome.storage?.onChanged?.addListener((changes, area) => {
  if(area==='local'&&changes.webCapture){webAccess.sync().catch(()=>{});if(changes.webCapture.newValue?.paused||changes.webCapture.newValue?.enabled===false)engine('speech-status').then(state=>{if(policy.webId(state.video?.videoId))return engine('speech-stop',{reason:'Website capture paused.'});}).catch(()=>{});}
  const settings = changes.settings?.newValue;
  if (area === 'local' && settings && (settings.speechEnabled === false || settings.enabled === false)) engine('speech-stop', {reason: 'Automatic speech-to-text is switched off.'}).catch(() => {});
  if (area === 'local' && settings && (settings.scenesEnabled === false || settings.enabled === false)) engine('vision-stop').catch(()=>{});
  if (area === 'local' && settings && (settings.screenTextEnabled === false || settings.enabled === false)) engine('ocr-stop').catch(()=>{});
});
