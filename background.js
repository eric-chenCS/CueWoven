// Service worker: routes messages between YouTube tabs, the popup/library pages
// and the offscreen document that holds the model and the index.
import {isExtensionPage} from './lib/message-source.js';
import {captureLabel} from './lib/capture-reason.js';
import { videoIdFromUrl } from './lib/video.js';
import './lib/scene-policy.js';
import {createWebAccess} from './lib/web-access.js';
import {policy} from './lib/web-items.js';
export { videoIdFromUrl } from './lib/video.js';

const OFFSCREEN_PATH = 'offscreen/offscreen.html';
import {DEFAULT_SETTINGS} from './lib/settings.js';
import {createDeviceSettings} from './lib/device-settings.js';
export {DEFAULT_SETTINGS};
const deviceSettings = createDeviceSettings({storage: {get: keys => chrome.storage.local.get(keys), set: value => chrome.storage.local.set(value)}, memory: chrome.system?.memory});

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

// Requests that save, trim or report images carry the chosen image storage size.
const SCENE_STORAGE_REQUESTS = new Set(['scene-index', 'article-image', 'import', 'prune', 'list']);
const ENGINE_READ_REQUESTS = new Set(['ping','warmup','has','search','status','list','export','vision-status','speech-status']);
async function engine(type, payload = {}) {
  if (SCENE_STORAGE_REQUESTS.has(type)) payload = { ...payload, sceneStorageMB: (await getSettings()).sceneStorageMB };
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    await ensureOffscreen();
    let res;
    try {
      res = await chrome.runtime.sendMessage(Object.assign({}, payload, { type, target: 'offscreen' }));
      if (res === undefined) throw new Error('The message channel closed without a response.');
    } catch (e) {
      lastErr = e;
      const message=String(e && e.message),missing=/Receiving end does not exist/i.test(message);
      if (!missing && !/message (?:port|channel) closed/i.test(message)) throw e;
      // A lost reply can follow a committed write; never replay ambiguous mutations.
      if(!missing&&!ENGINE_READ_REQUESTS.has(type))throw Error('Processing was interrupted. Check your library before retrying.');
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1))); // document still loading
      continue;
    }
    if (res && res.error) throw new Error(res.error);
    return res;
  }
  throw lastErr;
}

async function getSettings() {
  await deviceSettings();
  const { settings,webCapture } = await chrome.storage.local.get(['settings','webCapture']);
  return Object.assign({}, DEFAULT_SETTINGS, settings,settings?.lightMode?{speechEnabled:false,scenesEnabled:false,articleImagesEnabled:false,screenTextEnabled:false}:{},{youtubeBlocked:policy.matches('www.youtube.com',webCapture?.blocked||[])||policy.matches('youtu.be',webCapture?.blocked||[])});
}

// ---------------------------------------------------------------------------
// Toolbar badge feedback
// ---------------------------------------------------------------------------
let speechBadgeTab = null;
function captureIndicator(tabId,reason){
  if(tabId==null||tabId===speechBadgeTab)return;
  const active=['saved','duplicate'].includes(reason);
  chrome.action.setBadgeBackgroundColor({tabId,color:active?'#1f8a4c':'#727778'}).catch(()=>{});
  chrome.action.setBadgeText({tabId,text:'•'}).catch(()=>{});
  chrome.action.setTitle({tabId,title:'CueWoven · '+captureLabel(reason)}).catch(()=>{});
}
function flashBadge(tabId,text){captureIndicator(tabId,text==='✓'?'saved':'captions-unavailable');}
async function currentCaptureStatus(tabId){
  const tab=await chrome.tabs.get(tabId);
  if(tab.incognito)return {reason:'blocked-domain'};
  const id=videoIdFromUrl(tab.url);
  if(id){
    const settings=await getSettings();
    if(!settings.enabled||settings.youtubeBlocked)return {reason:settings.youtubeBlocked?'blocked-domain':'paused'};
    const context=await chrome.tabs.sendMessage(tabId,{type:'get-video'}).catch(()=>null);
    if(context?.video?.videoId===id && context.textCapture==='preparing-text')return {reason:'preparing-text'};
    const saved=await engine('has',{videoId:id});
    if(saved.textContent)return {reason:'saved'};
    const speech=await engine('speech-status');
    if(speech.video?.videoId===id && ['preparing','recording','stopping'].includes(speech.status))return {reason:'preparing-text'};
    return {reason:context?.video?.videoId===id && ['captions-unavailable','model-error'].includes(context.textCapture)?context.textCapture:'waiting'};
  }
  return webAccess.pageStatus(tabId);
}
async function refreshIndicator(tabId){const status=await currentCaptureStatus(tabId).catch(()=>({reason:'no-permission'}));captureIndicator(tabId,status.reason);}

function requireLibrary(sender) {
  if (!isExtensionPage(sender,chrome.runtime,['options/options.html'])) throw new Error('Open Library & settings to manage saved data.');
}

async function requireSpeechIdle() {
  if (['preparing', 'recording', 'stopping'].includes((await engine('speech-status')).status)) throw new Error('Pause automatic saving in Settings before changing saved data.');
}

async function requireYouTubeCapture(sender, videoId) {
  if (sender.tab?.incognito) throw Error('Incognito capture is excluded.');
  const settings = await getSettings();
  if (!settings.enabled || settings.youtubeBlocked) throw Error('Video capture is paused or excluded.');
  const matches = url => typeof url === 'string' && url.startsWith('https://www.youtube.com/') && videoIdFromUrl(url) === videoId;
  if (!sender.tab || sender.frameId > 0 || !/^[\w-]{11}$/.test(videoId || '') || !matches(sender.url)) throw Error('Invalid video capture source.');
  const tab = await chrome.tabs.get(sender.tab.id);
  if (tab.incognito || !matches(tab.url)) throw Error('The video changed before its captions were saved.');
}

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------

function requirePopup(sender) {
  if (!isExtensionPage(sender,chrome.runtime,['popup/popup.html'])) throw new Error('Use the CueWoven popup to control speech-to-text.');
}
async function speechContext(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if(tab.incognito)throw Error('Incognito capture is excluded.');
  if(!tab.url?.startsWith('https://www.youtube.com/watch?'))return webAccess.context(tabId);
  if((await getSettings()).youtubeBlocked)throw Error('YouTube is excluded in website settings. Allow youtube.com to resume.');
  const id = videoIdFromUrl(tab.url);
  if (!id || !tab.url.startsWith('https://www.youtube.com/watch?')) throw new Error('Open a normal YouTube video first.');
  const clock = await chrome.tabs.sendMessage(tabId, {type: 'speech-context'});
  if (clock?.video?.videoId !== id) throw new Error('Refresh the YouTube tab so CueWoven can read its playback timing.');
  return {tab, clock};
}


async function startSpeech(tabId, manual=false) {
  if (!Number.isInteger(tabId)) throw new Error('Invalid video tab.');
  const {tab, clock} = await speechContext(tabId);
  if (!manual && clock.video.audioLanguage && !/^(?:en(?:-|$)|und$)/i.test(clock.video.audioLanguage)) throw new Error('Automatic speech-to-text supports English audio only. Captions and scenes remain available.');
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
  async 'settings-defaults'(_input, sender) {
    requireLibrary(sender);
    return deviceSettings();
  },
  async 'youtube-saving-status'(_input,sender) {
    if(sender.url!==chrome.runtime.getURL(OFFSCREEN_PATH))throw Error('Invalid capture status request.');
    const settings=await getSettings();
    return {allowed:settings.enabled&&!settings.youtubeBlocked};
  },
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
    if(sender.url.startsWith('https://www.youtube.com/watch?')&&(await getSettings()).youtubeBlocked)return {disabled:true};
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
  // From YouTube tabs
  async 'index-metadata'({video}, sender) {
    await requireYouTubeCapture(sender, video?.videoId);
    const result = await engine('import-history', {videos:[video], historyImported:false});
    chrome.runtime.sendMessage({type:'index-changed'}).catch(() => {});
    return result;
  },
  async 'should-index'({ videoId, manual, watchedAt },sender) {
    if(sender?.tab?.incognito)return {index:false,reason:'Incognito capture is excluded.'};
    const s = await getSettings();
    if(s.youtubeBlocked)return {index:false,reason:'YouTube is excluded.'};
    if (!s.enabled) return { index: false, reason: 'Indexing is paused' };
    if (Number.isFinite(watchedAt) && watchedAt > 0 && watchedAt <= Date.now() + 60000) {
      await engine('touch-watch', { videoId, watchedAt });
    }
    if (manual) return { index: true };
    const { has } = await engine('has', { videoId });
    return { index: !has, reason: has ? 'Already indexed' : undefined };
  },
  async 'index-video'({ video, segments, method }, sender) {
    await requireYouTubeCapture(sender, video?.videoId);
    const res = await engine('index', { video, segments, method });
    flashBadge(sender.tab && sender.tab.id, '✓', '#1f8a4c');
    chrome.runtime.sendMessage({ type: 'index-changed' }).catch(() => {});
    return { chunkCount: res.chunkCount };
  },
  async 'index-failed'({ reason,title,metadataSaved }, sender) {
    flashBadge(sender.tab && sender.tab.id, metadataSaved ? '✓' : '!', metadataSaved ? '#1f8a4c' : '#b3261e');
    return { ok: true };
  },

  // From the popup / library page
  'capture-status':({tabId},sender)=>{requirePopup(sender);return currentCaptureStatus(tabId);},
  'video-status':({videoId},sender)=>{requirePopup(sender);return engine('has',{videoId});},
  'load-samples':(_data,sender)=>{requirePopup(sender);return engine('load-samples');},
  'forget-recent':async({hours},sender)=>{requireLibrary(sender);if(![1,24,168].includes(hours))throw Error('Invalid recent range.');await engine('speech-stop',{reason:'Forgetting recent items.'});const result=await engine('forget-recent',{hours});chrome.runtime.sendMessage({type:'index-changed'}).catch(()=>{});return result;},
  async search({ query, sinceDays, sinceMs, untilMs, exclude, singleVideo, distinct, offset = 0,kind,videoId,inferFilters }) {
    const s = await getSettings();
    if(videoId!==undefined&&!policy.ownerId(videoId))throw Error('Invalid video filter.');
    const range={...(sinceMs?{sinceMs}:{}),...(untilMs?{untilMs}:{}),...(exclude?{exclude}:{})};
    if (singleVideo === true || distinct === true) {
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid search position.');
      // The popup pages through distinct videos 12 at a time; singleVideo keeps the older two-result window.
      return engine('search', { query, sinceDays,...range,videoId,inferFilters, perVideo: 1, limit: distinct === true ? 12 : 2, offset,...(kind?{kind}:{}) });
    }
    return engine('search', { query, sinceDays,...range,videoId,inferFilters, perVideo: s.perVideo, limit: 12,...(kind?{kind}:{}) });
  },
  status: () => engine('status'),
  'search-mode':async(_input,sender)=>{
    if(sender.url!==chrome.runtime.getURL(OFFSCREEN_PATH))throw Error('Invalid search settings request.');
    return {lightMode:(await getSettings()).lightMode===true};
  },
  warmup: () => engine('warmup'),
  list: () => engine('list'),
  async delete({ videoId }) {
    await requireSpeechIdle();
    const r = await engine('delete', { videoId });
    chrome.runtime.sendMessage({ type: 'index-changed' }).catch(() => {});
    return r;
  },
  async clear() {
    await requireSpeechIdle();
    const r = await engine('clear');
    await webAccess.clearLog();
    chrome.runtime.sendMessage({ type: 'index-changed' }).catch(() => {});
    return r;
  },
  export: () => engine('export'),
  async import({ data }) {
    await requireSpeechIdle();
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
  prune: async () => {const s=await getSettings();return engine('prune',{maxAgeDays:s.maxAgeDays,importMaxAgeDays:s.importMaxAgeDays});},
};
const webAccess=createWebAccess({chrome,engine,getSettings,requireLibrary,requirePopup,onCapture:(tabId,reason)=>captureIndicator(tabId,reason)});
Object.assign(handlers,webAccess.handlers);
chrome.tabs?.onActivated?.addListener(({tabId})=>refreshIndicator(tabId));
chrome.tabs?.onUpdated?.addListener((tabId,change)=>{if(change.status==='complete'||change.url)refreshIndicator(tabId);});
chrome.permissions?.onAdded?.addListener(()=>webAccess.sync().catch(()=>{}));
chrome.permissions?.onRemoved?.addListener(async removed=>{if(removed.origins?.length||removed.permissions?.includes('scripting')){const settings=await webAccess.config();await chrome.storage.local.set({webCapture:{...settings,paused:true}});}webAccess.sync().catch(()=>{});});
chrome.runtime.onStartup?.addListener(()=>webAccess.sync().catch(()=>{}));

const LIBRARY_COMMANDS = new Set(['list','delete','clear','export','import','prune']);
const UI_COMMANDS = new Set(['search','status','warmup','index-tab','vision-status','speech-status']);
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
  const fn = Object.hasOwn(handlers,msg.type) && handlers[msg.type];
  if (!fn) return false; // e.g. broadcasts from the offscreen document
  Promise.resolve()
    .then(() => {
      if (LIBRARY_COMMANDS.has(msg.type)) requireLibrary(sender);
      if (UI_COMMANDS.has(msg.type) && !isExtensionPage(sender,chrome.runtime,['popup/popup.html','options/options.html'])) throw Error('Open the CueWoven popup or Library & settings.');
      return fn(msg, sender);
    })
    .then((r) => sendResponse(r))
    .catch((e) => sendResponse({ error: String((e && e.message) || e) }));
  return true;
});

// ---------------------------------------------------------------------------
// Housekeeping: daily auto-delete of old entries
// ---------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await deviceSettings();
  await webAccess.sync().catch(()=>{});
  chrome.alarms.create('recall-prune', { periodInMinutes: 24 * 60, delayInMinutes: 1 });
  if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#welcome') });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'recall-prune') handlers.prune().catch(() => {});
});

chrome.tabs?.onRemoved?.addListener(tabId => {
  if (tabId === speechBadgeTab) engine('speech-stop', {reason: 'The video tab was closed.'}).catch(() => {});
});


chrome.storage?.onChanged?.addListener((changes, area) => {
  if(area==='local'&&changes.webCapture&&(changes.webCapture.newValue?.paused||changes.webCapture.newValue?.enabled===false))engine('vision-stop').catch(()=>{});
  if(area==='local'&&changes.webCapture){webAccess.sync().catch(()=>{});if(changes.webCapture.newValue?.paused||changes.webCapture.newValue?.enabled===false)engine('speech-status').then(state=>{if(policy.webId(state.video?.videoId))return engine('speech-stop',{reason:'Website capture paused.'});}).catch(()=>{});}
  const settings = changes.settings?.newValue;
  if(area==='local'&&changes.settings&&!!changes.settings.oldValue?.lightMode!==!!settings?.lightMode)engine('rerank-stop').catch(()=>{});
  if (area === 'local' && settings && (settings.lightMode || settings.speechEnabled === false || settings.enabled === false)) engine('speech-stop', {reason: 'Automatic speech-to-text is switched off.'}).catch(() => {});
  if (area === 'local' && settings && (settings.lightMode || settings.scenesEnabled === false || settings.articleImagesEnabled === false || settings.enabled === false)) engine('vision-stop').catch(()=>{});
  if (area === 'local' && settings && (settings.lightMode || settings.screenTextEnabled === false || settings.enabled === false)) engine('ocr-stop').catch(()=>{});
});
