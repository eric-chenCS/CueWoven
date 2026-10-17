// Service worker: routes messages between YouTube tabs, the popup/library pages
// and the offscreen document that holds the model and the index.
import { historyVideos } from './lib/history.js';
import { videoIdFromUrl } from './lib/video.js';
import { createTranscriptQueue } from './lib/transcript-queue.js';
export { videoIdFromUrl } from './lib/video.js';

const OFFSCREEN_PATH = 'offscreen/offscreen.html';
export const DEFAULT_SETTINGS = { enabled: true, dwellSeconds: 20, maxAgeDays: 30, perVideo: 2 };

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
        justification: 'Runs the on-device embedding model and the local search index.',
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
  const { settings } = await chrome.storage.local.get('settings');
  return Object.assign({}, DEFAULT_SETTINGS, settings);
}

// ---------------------------------------------------------------------------
// Toolbar badge feedback
// ---------------------------------------------------------------------------
function flashBadge(tabId, text, color) {
  if (tabId == null) return;
  chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(() => {});
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 4000);
}

// ---------------------------------------------------------------------------
// Bulk pre-loading (the demo "insurance policy")
// ---------------------------------------------------------------------------
const waiters = new Map(); // tabId -> resolve({ok, reason})

async function fetchVideoTranscript(id, onTab = () => {}) {
  if ((await engine('has', {videoId: id})).has) return {videoId: id, status: 'skipped', reason: 'Already indexed'};
  const tab = await chrome.tabs.create({url: `https://www.youtube.com/watch?v=${id}&recall_index=1`, active: false});
  // Register immediately, before awaiting storage or mute operations.
  const outcome = new Promise(resolve => {
    const timer = setTimeout(() => { waiters.delete(tab.id); resolve({ok: false, reason: 'Timed out'}); }, 75000);
    waiters.set(tab.id, r => { clearTimeout(timer); waiters.delete(tab.id); resolve(r); });
  });
  try {
    onTab(tab.id);
    await chrome.tabs.update(tab.id, {muted: true});
    const result = await outcome;
    return {...result, videoId: id, status: result.ok ? 'done' : 'failed'};
  } finally {
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
    const jobs = createTranscriptQueue({
      initial: transcriptJob,
      processVideo: fetchVideoTranscript,
      beforeStart: () => engine('warmup'),
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
  if (['running', 'pausing'].includes((await getTranscriptJobs()).get()?.status)) throw new Error('Pause transcript fetching before changing saved data.');
}

let bulkRunning = false;
async function bulkIndex(urls) {
  if (bulkRunning) throw new Error('A pre-load is already running');
  bulkRunning = true;
  const results = [];
  // Keep this bounded operation alive while a tab is fetching its transcript.
  const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo().catch(() => {}), 20000);
  try {
    await engine('warmup');
    const ids = Array.from(new Set(urls.map(videoIdFromUrl).filter(Boolean)));
    for (const [n, id] of ids.entries()) {
      const report = (status, extra = {}) => {
        const item = Object.assign({ videoId: id, status, n: n + 1, total: ids.length }, extra);
        chrome.runtime.sendMessage(Object.assign({ type: 'bulk-progress' }, item)).catch(() => {});
        return item;
      };
      report('working');
      const result = await fetchVideoTranscript(id);
      results.push(report(result.status, result));
    }
    return { results };
  } finally {
    clearInterval(keepAlive);
    bulkRunning = false;
  }
}

function settleWaiter(tabId, outcome) {
  const w = tabId != null && waiters.get(tabId);
  if (w) w(outcome);
}

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------
const handlers = {
  async 'transcript-job-start'({urls}, sender) {
    requireLibrary(sender);
    if (bulkRunning) throw new Error('A pre-load is already running.');
    if (!Array.isArray(urls)) throw new Error('Provide video links to fetch.');
    const ids = urls.map(videoIdFromUrl).filter(Boolean);
    return {job: (await getTranscriptJobs()).start(ids)};
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
  async 'should-index'({ videoId, manual, watchedAt }) {
    const s = await getSettings();
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
      const res = await engine('index', { video, segments, method });
      flashBadge(sender.tab && sender.tab.id, '✓', '#1f8a4c');
      settleWaiter(sender.tab && sender.tab.id, { ok: true, chunkCount: res.chunkCount, title: res.video.title });
      chrome.runtime.sendMessage({ type: 'index-changed' }).catch(() => {});
      return { chunkCount: res.chunkCount };
    } catch (e) {
      settleWaiter(sender.tab && sender.tab.id, { ok: false, reason: String(e.message || e) });
      throw e;
    }
  },
  async 'index-failed'({ reason }, sender) {
    flashBadge(sender.tab && sender.tab.id, '!', '#b3261e');
    settleWaiter(sender.tab && sender.tab.id, { ok: false, reason });
    return { ok: true };
  },

  // From the popup / library page
  async search({ query, sinceDays, singleVideo, offset = 0 }) {
    const s = await getSettings();
    if (singleVideo === true) {
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid search position.');
      return engine('search', { query, sinceDays, perVideo: 1, limit: 2, offset });
    }
    return engine('search', { query, sinceDays, perVideo: s.perVideo, limit: 12 });
  },
  status: () => engine('status'),
  warmup: () => engine('warmup'),
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
  async 'bulk-index'({urls}) {
    if (['running', 'pausing'].includes((await getTranscriptJobs()).get()?.status)) throw new Error('Transcript fetching is already running.');
    return bulkIndex(Array.isArray(urls) ? urls.slice(0, 50) : []);
  },
  async 'index-tab'({ tabId }) {
    try {
      return await chrome.tabs.sendMessage(tabId, { type: 'index-now' });
    } catch (_) {
      return { ok: false, reason: 'Reload the YouTube tab once so Recall can attach to it, then try again.' };
    }
  },
  prune: async () => engine('prune', { maxAgeDays: (await getSettings()).maxAgeDays }),
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target === 'offscreen') return false;
  if (sender.id !== chrome.runtime.id) return false;
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
  const { settings } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: Object.assign({}, DEFAULT_SETTINGS, settings) });
  chrome.alarms.create('recall-prune', { periodInMinutes: 24 * 60, delayInMinutes: 1 });
  if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#welcome') });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'recall-prune') handlers.prune().catch(() => {});
});
