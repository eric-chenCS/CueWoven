// Isolated-world content script. Decides when a video has been watched long
// enough to index, asks yt-main.js for the transcript, and hands it to the
// extension's background worker.
(function () {
  'use strict';
  if(chrome.extension?.inIncognitoContext)return;
  if (window.__recallBridgeLoaded) return;
  window.__recallBridgeLoaded = true;

  const FROM_MAIN = 'recall-main';
  const FROM_BRIDGE = 'recall-bridge';
  const DEFAULTS = { enabled: true, dwellSeconds: 10, scenesEnabled: false,screenTextEnabled:true };
  const MAX_SEGMENTS = 20000;

  let playbackRevision = 0;
  for (const event of ['seeking', 'ratechange', 'pause', 'play']) document.addEventListener(event, () => {playbackRevision++;}, true);

  let current = null;       // { videoId, title, channel, lengthSeconds }
  let captureRevision = 0;
  let excluded=false;
  const excludedSite=config=>(config?.blocked||[]).some(site=>['www.youtube.com','youtu.be'].some(host=>host===site||host.endsWith('.'+site)));
  let speechPending = null;
  let textCapture = null;
  let dwellTimer = null;
  let dwellVisibility = null;
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

  async function settings() {
    try {
      const { settings,webCapture } = await chrome.storage.local.get(['settings','webCapture']);
      excluded=excludedSite(webCapture);
      const value=Object.assign({}, DEFAULTS, settings);return {...value,...(value.lightMode?{speechEnabled:false,scenesEnabled:false,screenTextEnabled:false}:{}),enabled:value.enabled&&!excluded};
    } catch (_) {
      return DEFAULTS;
    }
  }

  function clearDwell() {
    if (dwellTimer) clearTimeout(dwellTimer);
    dwellTimer = null;
    if (dwellVisibility) document.removeEventListener('visibilitychange', dwellVisibility);
    dwellVisibility = null;
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
        if (dwellTimer) clearTimeout(dwellTimer);
        dwellTimer = null;
      } else if (remaining > 0 && !dwellTimer) {
        startedAt = Date.now();
        tick();
      } else if (remaining <= 0) {
        document.removeEventListener('visibilitychange', onVis);
        run(false);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    dwellVisibility = onVis;
    if (!document.hidden) tick();
  }

  function logCapture(reason){send({type:'capture-outcome',kind:'video',reason,outcome:reason==='saved'?'saved':'skipped'}).catch(()=>{});}
  async function onVideo(video) {
    if (!video || typeof video.videoId !== 'string' || !/^[\w-]{6,20}$/.test(video.videoId)) return;
    if (current && current.videoId === video.videoId) {
      const wasShort = current.shortForm || current.lengthSeconds > 0 && current.lengthSeconds < 180;
      current = Object.assign({}, current, video);
      if (!wasShort && video.lengthSeconds > 0 && video.lengthSeconds < 180 && dwellTimer) {
        const s = await settings();
        if (s.enabled && current?.videoId === video.videoId && dwellTimer) {startVisual(s);startDwell(dwellSeconds(s, video), video.videoId);}
      }
      return;
    }
    current = video;
    speechPending = null;
    clearDwell();
    const s = await settings();
    if (current?.videoId !== video.videoId) return;
    startVisual(s);
    if (!s.enabled) {logCapture(excluded?'blocked-domain':'paused');return;}
    startDwell(dwellSeconds(s, video), video.videoId);
  }

  function dwellSeconds(s, video) {
    const seconds = Math.max(0, Number(s.dwellSeconds) || 0);
    return video.shortForm || video.lengthSeconds > 0 && video.lengthSeconds < 180 ? Math.min(seconds, 5) : seconds;
  }

  function startVisual(s) {
    const options = {...s, dwellSeconds:dwellSeconds(s, current || {})};
    globalThis.__recallScenes?.start(speechClock, options);
    globalThis.__recallScreen?.start(speechClock, options);
  }

  function activeMedia() {
    return [...document.querySelectorAll('video')].slice(0, 30).filter(video => {
      const r = video.getBoundingClientRect();
      return !video.ended && video.readyState >= 2 && r.width > 40 && r.height > 30 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && video.checkVisibility?.({checkOpacity:true,checkVisibilityCSS:true}) !== false;
    }).sort((a, b) => {
      const area = video => { const r = video.getBoundingClientRect(); return Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)); };
      return Number(a.paused) - Number(b.paused) || area(b) - area(a);
    })[0] || null;
  }
  globalThis.__recallMediaElement = activeMedia;

  function speechClock() {
    const media = activeMedia();
    return {video: current, time: media?.currentTime, paused: excluded || !media || media.paused, seeking: !!media?.seeking, rate: media?.playbackRate || 1, ad: !!media?.closest('.ad-showing, .ad-interrupting'), revision: playbackRevision, visible: !excluded && !document.hidden};
  }

  async function trySpeech() {
    if (!speechPending || speechPending !== current?.videoId) return;
    if (current.audioLanguage && !/^(?:en(?:-|$)|und$)/i.test(current.audioLanguage)) {speechPending=null;return;}
    const clock = speechClock();
    if (!clock.visible || clock.paused || clock.ad) return;
    const id = speechPending;
    speechPending = null;
    const response = await send({type: 'speech-auto-start'});
    if (response?.inactive && current?.videoId === id) speechPending = id;
  }
  for (const event of ['play', 'playing', 'visibilitychange']) document.addEventListener(event, trySpeech, true);

  const running = new Map();
  async function run(manual) {
    const id = current?.videoId;
    const revision = captureRevision;
    if (running.has(id)) return running.get(id);
    const task = (async () => {
      if (!current) return { ok: false, reason: 'Open a YouTube video first.' };
      const video = Object.assign({}, current, { watchedAt: Date.now() });
      const check = await send({ type: 'should-index', videoId: video.videoId, manual, watchedAt: video.watchedAt });
      if (check && check.error) return { ok: false, reason: check.error };
      if(!check||!check.index){logCapture(check?.reason==='Indexing is paused'?'paused':'duplicate');return {ok:true,skipped:true,reason:check&&check.reason};}
      if(captureRevision!==revision || current?.videoId!==video.videoId)return {ok:false,reason:'The capture was cancelled.'};

      textCapture = {videoId:id, revision, reason:'preparing-text'};
      const metadata = send({type:'index-metadata', video});
      const t = await requestTranscript(video.videoId, manual);
      const latest = await settings();
      if (!latest.enabled || captureRevision !== revision || current?.videoId !== video.videoId) {
        if(latest.enabled && current?.videoId===video.videoId)startDwell(dwellSeconds(latest,current),video.videoId);
        return {ok:false,reason:'Saving was paused, excluded, or the video changed.'};
      }
      const segments = (t.segments || []).slice(0, MAX_SEGMENTS);
      if (!segments.length) {
        const reason = t.error || 'This video has no captions.';
        logCapture('captions-unavailable');
        const saved = await metadata;
        await send({ type: 'index-failed', videoId: video.videoId,title:video.title, reason, metadataSaved: !saved?.error });
        if (current?.videoId === video.videoId) {speechPending = video.videoId;trySpeech();}
        return { ok: !saved?.error, titleOnly: !saved?.error, reason: saved?.error || reason };
      }
      const res = await send({ type: 'index-video', video, segments, method: t.method });
      if (!res || res.error) return { ok: false, reason: (res && res.error) || 'Indexing failed' };
      logCapture('saved');return { ok: true, chunkCount: res.chunkCount, title: video.title };
    })();
    running.set(id, task);
    try {
      const result = await task;
      if (textCapture?.videoId === id && textCapture.revision === revision) textCapture.reason = result.ok ? (result.titleOnly ? 'captions-unavailable' : 'saved') : 'model-error';
      return result;
    } catch (error) {
      if (textCapture?.videoId === id && textCapture.revision === revision) textCapture.reason = 'model-error';
      return {ok:false,reason:error.message};
    } finally {
      running.delete(id);
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const d = event.data;
    if (!d || d.source !== FROM_MAIN) return;
    if (d.type === 'video-reset') {captureRevision++;current=null;speechPending=null;clearDwell();globalThis.__recallScenes?.stop();globalThis.__recallScreen?.stop();}
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
      sendResponse({ video: current, textCapture: textCapture?.videoId === current?.videoId && textCapture?.revision === captureRevision ? textCapture.reason : 'waiting' });
      return false;
    }
    return false;
  });

  chrome.storage.onChanged?.addListener((changes,area)=>{
    if(area!=='local')return;
    if(changes.settings){
      if(changes.settings.newValue?.enabled===false){captureRevision++;clearDwell();speechPending=null;}
      if(current)settings().then(s=>{if(current){startVisual(s);if(s.enabled&&(changes.settings.oldValue?.enabled===false||changes.settings.oldValue?.speechEnabled===false&&s.speechEnabled!==false||changes.settings.oldValue?.lightMode===true&&!s.lightMode))startDwell(dwellSeconds(s,current),current.videoId);}});
    }
    if(!changes.webCapture)return;
    const previous=excluded;excluded=excludedSite(changes.webCapture.newValue);
    if(excluded){captureRevision++;clearDwell();speechPending=null;globalThis.__recallScenes?.stop();globalThis.__recallScreen?.stop();globalThis.__recallPageAudio?.stop(undefined,true).catch(()=>{});}
    else if(previous&&current)settings().then(s=>{if(current){startVisual(s);if(s.enabled)startDwell(dwellSeconds(s,current),current.videoId);}});
  });
  // yt-main.js may have announced the video before this script loaded.
  toMain({ type: 'hello' });
})();
