// Runs in YouTube's own page context (MAIN world) so it can read the player's
// data and call YouTube's endpoints with the page's own session.
// It talks to content/yt-bridge.js (isolated world) through window.postMessage.
(function () {
  'use strict';
  if (window.__recallMainLoaded) return;
  window.__recallMainLoaded = true;

  const P = window.__recallParse;
  const FROM_MAIN = 'recall-main';
  const FROM_BRIDGE = 'recall-bridge';
  const MIN_SEGMENTS = 3;

  // ---------------------------------------------------------------------------
  // 1. Remember the caption URLs the player itself requests. Recent YouTube
  //    builds sign these with a token, so reusing the player's URL is the most
  //    reliable way to get captions when they are turned on.
  // ---------------------------------------------------------------------------
  const capturedCaptionUrls = new Map(); // videoId -> url
  const capturedCaptionData = new Map(); // videoId -> parsed player response

  function remember(map, videoId, value) {
    map.delete(videoId);
    map.set(videoId, value);
    if (map.size > 3) map.delete(map.keys().next().value);
  }

  function captureUrl(u) {
    if (!u || typeof u !== 'string' || u.indexOf('/api/timedtext') === -1) return;
    try {
      const url = new URL(u, location.origin);
      const v = url.searchParams.get('v');
      if (url.origin !== location.origin || url.pathname !== '/api/timedtext' || !/^[\w-]{11}$/.test(v || '')) return null;
      remember(capturedCaptionUrls, v, url.toString());
      return v;
    } catch (_) { /* ignore */ }
    return null;
  }

  function captureBody(videoId, body) {
    try {
      if (typeof body !== 'string' || body.length > 16 * 1024 * 1024) return;
      const segments = P.parseTimedText(body).slice(0, 20000);
      if (segments.length >= MIN_SEGMENTS) remember(capturedCaptionData, videoId, segments);
    } catch (_) { /* an unsupported player response must not affect playback */ }
  }

  const origOpen = XMLHttpRequest.prototype.open;
  const xhrVideos = new WeakMap();
  const observedXhrs = new WeakSet();
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      xhrVideos.set(this, captureUrl(String(url)));
      if (!observedXhrs.has(this)) {
        observedXhrs.add(this);
        this.addEventListener('load', () => {
          const videoId = xhrVideos.get(this);
          if (!videoId) return;
          try {
            captureBody(videoId, this.responseType === 'json' ? JSON.stringify(this.response) : this.responseText);
          } catch (_) { /* binary responses are not transcripts */ }
        });
      }
    } catch (_) { /* ignore */ }
    return origOpen.apply(this, arguments);
  };
  const origFetch = window.fetch;
  window.fetch = function (input) {
    const response = origFetch.apply(this, arguments);
    try {
      const videoId = captureUrl(typeof input === 'string' ? input : input && (input.url || input.href));
      if (videoId) response.then(r => r.clone().text().then(body => captureBody(videoId, body)).catch(() => {})).catch(() => {});
    } catch (_) { /* ignore */ }
    return response;
  };

  // ---------------------------------------------------------------------------
  // 2. Detect the current video (YouTube is a single-page app).
  // ---------------------------------------------------------------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function currentVideoId() {
    const id = location.pathname === '/watch' ? new URLSearchParams(location.search).get('v') : location.pathname.match(/^\/(?:shorts|live)\/([\w-]{11})\/?$/)?.[1];
    return /^[\w-]{11}$/.test(id || '') ? id : null;
  }

  function playerResponseFor(videoId) {
    for (const player of document.querySelectorAll('#shorts-player, #movie_player')) try {
      const pr = player && typeof player.getPlayerResponse === 'function' && player.getPlayerResponse();
      if (pr && pr.videoDetails && pr.videoDetails.videoId === videoId) return pr;
    } catch (_) { /* ignore */ }
    const init = window.ytInitialPlayerResponse;
    if (init && init.videoDetails && init.videoDetails.videoId === videoId) return init;
    return null;
  }

  async function waitForPlayerResponse(videoId, tries = 20) {
    const deadline = Date.now() + tries * 500;
    do {
      const pr = playerResponseFor(videoId);
      if (pr) return pr;
      await sleep(500);
    } while (Date.now() < deadline);
    return null;
  }

  function post(msg) {
    window.postMessage(Object.assign({ source: FROM_MAIN }, msg), location.origin);
  }

  let lastAnnounced = null;
  async function announce(force) {
    const videoId = currentVideoId();
    if (!videoId) {if(lastAnnounced!==null)post({type:'video-reset'});lastAnnounced=null;return;}
    // Announce immediately: player metadata can arrive after a short has ended.
    const pr = playerResponseFor(videoId);
    if (currentVideoId() !== videoId) return; // navigated away meanwhile
    const d = (pr && pr.videoDetails) || {};
    const signature = JSON.stringify([videoId, d.title || document.title, d.author, d.lengthSeconds, P.speechLanguage(pr)]);
    if (!force && signature === lastAnnounced) return;
    lastAnnounced = signature;
    post({
      type: 'video',
      video: {
        videoId,
        title: d.title || document.title.replace(/ - YouTube$/, ''),
        channel: d.author || '',
        lengthSeconds: Number(d.lengthSeconds) || 0,
        audioLanguage: P.speechLanguage(pr),
        shortForm: location.pathname.startsWith('/shorts/'),
      },
    });
  }

  document.addEventListener('yt-navigate-finish', () => announce(false));
  document.addEventListener('yt-navigate-start', () => {lastAnnounced=null;post({type:'video-reset'});});
  setInterval(() => announce(false), 500);
  window.addEventListener('popstate', () => setTimeout(() => announce(false), 300));
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => announce(false));
  } else {
    announce(false);
  }

  // ---------------------------------------------------------------------------
  // 3. Transcript strategies, tried in order until one returns real text.
  // ---------------------------------------------------------------------------
  function withJson3(url) {
    const u = new URL(url, location.origin);
    u.searchParams.set('fmt', 'json3');
    return u.toString();
  }

  async function fetchTimedText(url) {
    // Try the exact signed URL first; changing its format can invalidate the request.
    for (const candidate of new Set([url, withJson3(url)])) {
      const res = await origFetch.call(window, candidate, { credentials: 'include', signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('timedtext HTTP ' + res.status);
      const segments = P.parseTimedText(await res.text());
      if (segments.length >= MIN_SEGMENTS) return segments;
    }
    return [];
  }

  async function fromCapturedUrl(videoId) {
    if (capturedCaptionData.has(videoId)) return capturedCaptionData.get(videoId);
    const url = capturedCaptionUrls.get(videoId);
    return url ? fetchTimedText(url) : [];
  }

  async function fromPlayerRequest(videoId) {
    if (currentVideoId() !== videoId) return [];
    const player = [...document.querySelectorAll('#shorts-player, #movie_player')].find(player => {
      try { return player.getPlayerResponse?.()?.videoDetails?.videoId === videoId; } catch (_) { return false; }
    }) || (location.pathname === '/watch' ? document.getElementById('movie_player') : document.querySelector('ytd-reel-video-renderer[is-active] #shorts-player'));
    const button = player?.querySelector('.ytp-subtitles-button');
    const pressed = button && button.getAttribute('aria-pressed');
    if (!button || !['true', 'false'].includes(pressed) || button.getAttribute('aria-disabled') === 'true') return [];
    let userChanged = false;
    const onPointer = event => { if (event.isTrusted) userChanged = true; };
    const onKey = event => { if (event.isTrusted && (event.key?.toLowerCase() === 'c' || event.target === button && [' ', 'Enter'].includes(event.key))) userChanged = true; };
    button.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    try {
      if (pressed === 'false') button.click();
      const deadline = Date.now() + 4500;
      while (Date.now() < deadline) {
        if (currentVideoId() !== videoId) return [];
        if (capturedCaptionData.has(videoId)) return capturedCaptionData.get(videoId);
        await sleep(300);
      }
      return fromCapturedUrl(videoId);
    } finally {
      button.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      if (pressed === 'false' && !userChanged && currentVideoId() === videoId && button.isConnected && button.getAttribute('aria-pressed') === 'true') button.click();
    }
  }

  async function fromCaptionTracks(videoId) {
    const pr = await waitForPlayerResponse(videoId, 6);
    const tracks =
      pr && pr.captions && pr.captions.playerCaptionsTracklistRenderer &&
      pr.captions.playerCaptionsTracklistRenderer.captionTracks;
    const track = P.pickCaptionTrack(tracks);
    return track && track.baseUrl ? fetchTimedText(track.baseUrl) : [];
  }

  function ytcfgGet(key) {
    try {
      if (window.ytcfg && typeof window.ytcfg.get === 'function') return window.ytcfg.get(key);
      return window.ytcfg && window.ytcfg.data_ && window.ytcfg.data_[key];
    } catch (_) {
      return undefined;
    }
  }

  async function innertube(endpoint, body) {
    const context = ytcfgGet('INNERTUBE_CONTEXT');
    if (!context) throw new Error('no innertube context');
    const key = ytcfgGet('INNERTUBE_API_KEY');
    const url = '/youtubei/v1/' + endpoint + '?prettyPrint=false' + (key ? '&key=' + encodeURIComponent(key) : '');
    const headers = { 'Content-Type': 'application/json' };
    const clientName = ytcfgGet('INNERTUBE_CONTEXT_CLIENT_NAME');
    const clientVersion = ytcfgGet('INNERTUBE_CONTEXT_CLIENT_VERSION');
    if (clientName) headers['X-Youtube-Client-Name'] = String(clientName);
    if (clientVersion) headers['X-Youtube-Client-Version'] = String(clientVersion);
    const res = await origFetch.call(window, url, {
      method: 'POST',
      credentials: 'include',
      signal: AbortSignal.timeout(5000),
      headers,
      body: JSON.stringify(Object.assign({ context }, body)),
    });
    if (!res.ok) throw new Error(endpoint + ' HTTP ' + res.status);
    return res.json();
  }

  async function fromTranscriptPanelApi(videoId) {
    // Fresh /next response for this video, so this also works after SPA navigation.
    const next = await innertube('next', { videoId });
    const endpoints = P.findAll(next, 'getTranscriptEndpoint');
    const params = endpoints.map((e) => e && e.params).find(Boolean);
    if (!params) return [];
    const data = await innertube('get_transcript', { params });
    return P.parseInnertubeTranscript(data);
  }

  // Last resort: open YouTube's own "Show transcript" panel and read it.
  // Only used for manual indexing because it visibly opens a side panel.
  async function fromTranscriptDom(videoId) {
    if (currentVideoId() !== videoId) return [];
    const readPanel = () => P.parseTranscriptDom(document);

    let segs = readPanel();
    if (segs.length >= MIN_SEGMENTS) return normalize(segs);

    const expand = document.querySelector('#description-inline-expander #expand, tp-yt-paper-button#expand');
    if (expand) { expand.click(); await sleep(400); }
    const button =
      document.querySelector('ytd-video-description-transcript-section-renderer button') ||
      Array.from(document.querySelectorAll('button')).find((b) => /show transcript/i.test(b.textContent || '') || /show transcript/i.test(b.getAttribute('aria-label') || ''));
    if (!button) return [];
    button.click();
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      await sleep(400);
      if (currentVideoId() !== videoId) return [];
      segs = readPanel();
      if (segs.length >= MIN_SEGMENTS) break;
    }
    return normalize(segs);
  }

  function normalize(segs) {
    return segs
      .map((s) => ({ start: s.start, dur: 0, text: P.cleanText(s.text || '') }))
      .filter((s) => s.text);
  }

  async function getTranscript(videoId, allowDom) {
    const strategies = [
      ['player-captions', fromCapturedUrl],
      ['caption-tracks', fromCaptionTracks],
      ['player-request', fromPlayerRequest],
      ['transcript-api', fromTranscriptPanelApi],
    ];
    if (allowDom) strategies.push(['transcript-panel', fromTranscriptDom]);
    const errors = [];
    for (const [method, fn] of strategies) {
      if (currentVideoId() !== videoId) return {segments: [], error: 'The video changed while fetching its transcript.'};
      try {
        const segments = await fn(videoId);
        if (currentVideoId() !== videoId) return {segments: [], error: 'The video changed while fetching its transcript.'};
        if (segments && segments.length >= MIN_SEGMENTS) return { segments, method };
        errors.push(method + ': empty');
      } catch (e) {
        errors.push(method + ': ' + (e && e.message ? e.message : e));
      }
    }
    return { segments: [], method: null, error: 'No transcript found (' + errors.join('; ') + ')' };
  }

  // ---------------------------------------------------------------------------
  // 4. Requests from the bridge.
  // ---------------------------------------------------------------------------
  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const d = event.data;
    if (!d || d.source !== FROM_BRIDGE) return;
    if (d.type === 'hello') {
      announce(true);
    } else if (d.type === 'getTranscript' && typeof d.videoId === 'string') {
      const result = await getTranscript(d.videoId, !!d.allowDom);
      post(Object.assign({ type: 'transcript', reqId: d.reqId, videoId: d.videoId }, result));
    }
  });
})();
