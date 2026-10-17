// Isolated-world content script. Decides when a video has been watched long
// enough to index, asks yt-main.js for the transcript, and hands it to the
// extension's background worker.
(function () {
  'use strict';
  if (window.__recallBridgeLoaded) return;
  window.__recallBridgeLoaded = true;

  const FROM_MAIN = 'recall-main';
  const FROM_BRIDGE = 'recall-bridge';
  const DEFAULTS = { enabled: true, dwellSeconds: 20, scenesEnabled: true };
  const MAX_SEGMENTS = 20000;

  let playbackRevision = 0;
  for (const event of ['seeking', 'ratechange', 'pause', 'play']) document.addEventListener(event, () => {playbackRevision++;}, true);

  let current = null;       // { videoId, title, channel, lengthSeconds }
  let speechPending = null;
  let dwellTimer = null;
  let reqCounter = 0;
  const pending = new Map(); // reqId -> resolve

  async function send(msg) {
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (e) {
      // Happens after the extension is reloaded while this tab stays open.
      return { error: String(e && e.message || e) };
    }
  }

  function toMain(msg) {
    window.postMessage(Object.assign({ source: FROM_BRIDGE }, msg), location.origin);
  }

  function requestTranscript(videoId, allowDom) {
    const reqId = ++reqCounter;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        pending.delete(reqId);
        resolve({ segments: [], error: 'Timed out fetching transcript' });
      }, 60000);
      pending.set(reqId, (r) => { clearTimeout(timeout); resolve(r); });
      toMain({ type: 'getTranscript', videoId, reqId, allowDom });
    });
  }

  function isForcedIndex() {
    return new URLSearchParams(location.search).get('recall_index') === '1';
  }

  async function settings() {
    try {
      const { settings } = await chrome.storage.local.get('settings');
      return Object.assign({}, DEFAULTS, settings);
    } catch (_) {
      return DEFAULTS;
    }
  }

  function clearDwell() {
    if (dwellTimer) clearTimeout(dwellTimer);
    dwellTimer = null;
  }

  // Only count time while the tab is actually visible.
  function startDwell(seconds, videoId) {
    clearDwell();
    let remaining = seconds * 1000;
    let startedAt = Date.now();
    const tick = () => {
      dwellTimer = setTimeout(() => {
        dwellTimer = null;
        remaining = 0;
        if (!current || current.videoId !== videoId) return;
        if (document.hidden) return; // runs on the next visibilitychange
        document.removeEventListener('visibilitychange', onVis);
        run(false);
      }, remaining);
    };
    const onVis = () => {
      if (!current || current.videoId !== videoId) {
        document.removeEventListener('visibilitychange', onVis);
        return;
      }
      if (document.hidden) {
        remaining -= Date.now() - startedAt;
        clearDwell();
      } else if (remaining > 0 && !dwellTimer) {
        startedAt = Date.now();
        tick();
      } else if (remaining <= 0) {
        document.removeEventListener('visibilitychange', onVis);
        run(false);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    if (!document.hidden) tick();
  }

  async function onVideo(video) {
    if (!video || typeof video.videoId !== 'string' || !/^[\w-]{6,20}$/.test(video.videoId)) return;
    if (current && current.videoId === video.videoId) {
      current = Object.assign({}, current, video);
      return;
    }
    current = video;
    speechPending = null;
    clearDwell();
    if (isForcedIndex()) {
      run(true);
      return;
    }
    const s = await settings();
    globalThis.__recallScenes?.start(speechClock, s);
    if (!s.enabled) return;
    startDwell(Math.max(0, Number(s.dwellSeconds) || 0), video.videoId);
  }

  function speechClock() {
    const media = document.querySelector('video');
    return {video: current, time: media?.currentTime, paused: !media || media.paused, seeking: !!media?.seeking, rate: media?.playbackRate || 1, ad: !!document.querySelector('.ad-showing, .ad-interrupting'), revision: playbackRevision, forced: isForcedIndex(), visible: !document.hidden};
  }

  async function trySpeech() {
    if (!speechPending || speechPending !== current?.videoId || isForcedIndex()) return;
    if (current.audioLanguage && !/^en(?:-|$)/i.test(current.audioLanguage)) {speechPending=null;return;}
    const clock = speechClock();
    if (!clock.visible || clock.paused || clock.ad) return;
    const id = speechPending;
    speechPending = null;
    const response = await send({type: 'speech-auto-start'});
    if (response?.inactive && current?.videoId === id) speechPending = id;
  }
  for (const event of ['play', 'playing', 'visibilitychange']) document.addEventListener(event, trySpeech, true);

  let running = null;
  async function run(manual) {
    if (running) return running;
    running = (async () => {
      if (!current) return { ok: false, reason: 'Open a YouTube video first.' };
      const video = Object.assign({}, current, { watchedAt: isForcedIndex() ? undefined : Date.now() });
      const check = await send({ type: 'should-index', videoId: video.videoId, manual, watchedAt: video.watchedAt });
      if (check && check.error) return { ok: false, reason: check.error };
      if (!check || !check.index) return { ok: true, skipped: true, reason: check && check.reason };

      const t = await requestTranscript(video.videoId, manual);
      const segments = (t.segments || []).slice(0, MAX_SEGMENTS);
      if (!segments.length) {
        const reason = t.error || 'This video has no captions.';
        await send({ type: 'index-failed', videoId: video.videoId, reason });
        if (!isForcedIndex() && current?.videoId === video.videoId) {speechPending = video.videoId;trySpeech();}
        return { ok: false, reason };
      }
      const res = await send({ type: 'index-video', video, segments, method: t.method });
      if (!res || res.error) return { ok: false, reason: (res && res.error) || 'Indexing failed' };
      return { ok: true, chunkCount: res.chunkCount, title: video.title };
    })();
    try {
      return await running;
    } finally {
      running = null;
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const d = event.data;
    if (!d || d.source !== FROM_MAIN) return;
    if (d.type === 'video-reset') {current=null;speechPending=null;clearDwell();globalThis.__recallScenes?.stop();}
    else if (d.type === 'video') onVideo(d.video);
    else if (d.type === 'transcript' && pending.has(d.reqId)) {
      const resolve = pending.get(d.reqId);
      pending.delete(d.reqId);
      resolve({ segments: Array.isArray(d.segments) ? d.segments : [], method: d.method, error: d.error });
    }
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.target === 'offscreen') return false;
    if (msg.type === 'index-now') {
      run(true).then(sendResponse);
      return true;
    }
    if (msg.type === 'speech-audio-open') {
      globalThis.__recallPageAudio.start(msg.id, speechClock).then(sendResponse).catch(error => sendResponse({error: error.message}));return true;
    }
    if (msg.type === 'speech-audio-close') {
      globalThis.__recallPageAudio.stop(msg.id).then(() => sendResponse({ok: true})).catch(error => sendResponse({error: error.message}));return true;
    }
    if (msg.type === 'speech-context') {
      sendResponse(speechClock());
      return false;
    }
    if (msg.type === 'get-video') {
      sendResponse({ video: current });
      return false;
    }
    return false;
  });

  // yt-main.js may have announced the video before this script loaded.
  toMain({ type: 'hello' });
})();
