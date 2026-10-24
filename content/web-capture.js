// Opt-in top-frame capture; form values, private pages and other tabs are excluded.
(function() {
  if (globalThis.__recallWebCapture || chrome.extension?.inIncognitoContext) return;
  globalThis.__recallWebCapture = true;
  const P = globalThis.__recallWebPolicy, send = (msg) => chrome.runtime.sendMessage(msg).catch((error) => ({ error: error.message }));
  let config = {}, settings = {}, selected = null, selectedSrc = "", videoInfo = null, revision = 0, busy = false, pageUrl = "", eligibleAt = Date.now(), lastText = "", lastSaved = 0, lastChecked = 0, mediaSince = 0, speechAttempted = false, cuesSeen = new Set();
  let lastReason = "waiting", reportedReason = "", reportedAt = 0;
  function report(reason) {
    lastReason = reason;
    if (reason === reportedReason && Date.now() - reportedAt < 3e4) return;
    reportedReason = reason;
    reportedAt = Date.now();
    send({ type: "capture-outcome", reason, kind: videoInfo ? "video" : "page", outcome: reason === "saved" ? "saved" : "skipped" });
  }
  function skipReason() {
    return !P.safeUrl(location.href) || P.matches(location.hostname, config.blocked || []) ? "blocked-domain" : settings.enabled === false || !config.enabled || config.paused ? "paused" : !P.allowed(location.href, config) ? "no-permission" : privatePage() ? "private-form" : document.hidden ? "hidden" : null;
  }
  function rendered(element) {
    if (!element.getClientRects().length) return false;
    if (element.checkVisibility) return element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
    }
    return true;
  }
  function privatePage() {
    if (document.querySelector("[data-recall-private],[data-private]")) return true;
    if([...document.querySelectorAll('a,button,[role="button"]')].slice(0,300).some(node=>rendered(node)&&/^(?:sign\s*out|log\s*out|logout|cerrar sesi[oó]n|d[eé]connexion|abmelden)$/i.test(node.textContent.trim())))return true;
    if ([...document.querySelectorAll('input[type="password"],input[autocomplete="current-password"],input[autocomplete="new-password"],input[autocomplete~="one-time-code"],input[autocomplete^="cc-"]')].some(rendered)) return true;
    return [...document.querySelectorAll('[contenteditable]:not([contenteditable="false"]),textarea')].slice(0, 100).some((editor) => {
      if (!rendered(editor)) return false;
      const rect = editor.getBoundingClientRect(), width = Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left)), height = Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top));
      return width * height >= innerWidth * innerHeight * 0.5;
    });
  }
  const eligible = () => settings.enabled !== false && P.allowed(location.href, config) && !privatePage();
  function visible(video) {
    const rect = video.getBoundingClientRect();
    return rendered(video) && rect.width > 40 && rect.height > 30 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
  }
  function choose() {
    return [...document.querySelectorAll("video")].slice(0, 30).filter((v) => !v.paused && !v.ended && v.readyState >= 2 && visible(v)).sort((a, b) => {
      const area = (v) => {
        const r = v.getBoundingClientRect();
        return Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      };
      return area(b) - area(a);
    })[0] || null;
  }
  function clock() {
    const current = eligible(), same = sameMedia();
    return { reason: skipReason() || lastReason, private: !current, video: current && same ? videoInfo : null, time: selected?.currentTime, paused: !current || !same || !selected || selected.paused, visible: current && !document.hidden && (!selected || visible(selected)), seeking: !!selected?.seeking, rate: selected?.playbackRate || 1, ad: !!selected?.closest('.ad-showing,.ad-interrupting,[data-ad="true"]'), revision };
  }
  function sameMedia() {
    return selected && selected.currentSrc === selectedSrc && choose() === selected && mediaAddress(selected).url === videoInfo?.url;
  }
  globalThis.__recallMediaElement = () => sameMedia() ? selected : null;
  function stopMedia() {
    revision++;
    globalThis.__recallScenes?.stop();
    globalThis.__recallScreen?.stop();
    globalThis.__recallPageAudio?.stop(void 0, true).catch(() => {
    });
    selected = null;
    videoInfo = null;
    selectedSrc = "";
    cuesSeen = new Set();
    speechAttempted = false;
  }
  function mediaAddress(video) {
    const captionSelector = '[data-e2e="video-desc"],[data-e2e="browse-video-desc"],[data-ad-preview="message"],[data-testid="tweetText"],[slot="text-body"],h1,h2,h3';
    let post = video.closest('article,[data-testid="tweet"],shreddit-post,[data-e2e="feed-video"],[data-e2e="recommend-list-item-container"], [data-e2e="user-post-item"]');
    if (!post) for (let node=video.parentElement; node && node!==document.body; node=node.parentElement) {
      if (node.querySelectorAll('video').length>1) break;
      if (node.querySelector(captionSelector)) {post=node;break;}
    }
    const links = post ? [...post.querySelectorAll("a[href]")].slice(0, 100) : [];
    const direct = links.map((a) => P.safeUrl(a.href)).find((url2) => url2?.hostname === location.hostname && /\/(?:reels?|p|video|videos|status)\/[\w-]+/.test(url2.pathname));
    const url = direct || P.safeUrl(location.href);
    const stable = /\/(?:reels?|p|video|videos|status)\/[\w-]+/.test(url.pathname);
    const caption = post?.querySelector(captionSelector)?.textContent || (stable && url.pathname===location.pathname ? document.querySelector('meta[property="og:description"]')?.content : '') || '';
    const text = P.redactText(caption).trim().slice(0, 4000);
    const title = (video.getAttribute("aria-label") || text || document.querySelector('meta[property="og:title"]')?.content || document.title || location.hostname).trim().slice(0, 300);
    let sourceHint = "";
    if (!stable) {
      try {
        const src = new URL(video.currentSrc, location.href);
        // A blob: address is new on every page load, so it would save the same feed video again; use stable clues.
        const poster = video.poster && !video.poster.startsWith("blob:") ? video.poster : "";
        sourceHint = src.protocol === "blob:" ? ["clues", poster, text, title, Math.round(video.duration || 0)].join("|").slice(0, 4096) : src.origin + src.pathname;
      } catch {
        sourceHint = video.currentSrc.slice(0, 4096);
      }
    }
    return { url: url.href, sourceHint, text, title };
  }
  function pageText() {
    const candidates = [...document.querySelectorAll('article,main,[role="main"]')].slice(0, 16).filter(rendered);
    const root = candidates.sort((a, b) => (b.innerText?.length || 0) - (a.innerText?.length || 0))[0] || document.body;
    if (!root) return "";
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), parts = [];
    let count = 0, words = 0, node;
    while ((node = walker.nextNode()) && count++ < 8e3 && words < 2e3) {
      const parent = node.parentElement;
      if (!parent || parent.closest('script,style,noscript,nav,header,footer,aside,form,input,textarea,button,[hidden],[aria-hidden="true"],[contenteditable]:not([contenteditable="false"])') || !rendered(parent)) continue;
      const style = getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const text = node.textContent.replace(/\s+/g, " ").trim();
      if (!text) continue;
      const list = text.split(" ").slice(0, 2e3 - words);
      words += list.length;
      parts.push(list.join(" "));
    }
    return P.redactText(parts.join("\n")).slice(0, 6e4);
  }
  async function tick(force = false) {
    if (busy) return;
    busy = true;
    try {
      const url = P.safeUrl(location.href)?.href;
      if (url !== pageUrl) {
        stopMedia();
        pageUrl = url || "";
        eligibleAt = Date.now();
        globalThis.__recallArticleImages?.reset();
        lastText = "";
        lastSaved = 0;
        lastChecked = 0;
      }
      if (document.hidden || !eligible()) {
        report(skipReason() || "waiting");
        stopMedia();
        eligibleAt = Date.now();
        return;
      }
      const video = choose();
      if (video !== selected || video && (video.currentSrc !== selectedSrc || mediaAddress(video).url !== videoInfo?.url)) {
        stopMedia();
        if (video) {
          selected = video;
          selectedSrc = video.currentSrc;
          const activeRevision = revision, address = mediaAddress(video), languages = [...video.textTracks].map((track) => track.language).filter(Boolean), audioLanguage = video.lang || (languages.some((lang) => !/^en(?:-|$)/i.test(lang)) ? "unknown" : languages[0] || "");
          const result = await send({ type: "web-identify", ...address, audioLanguage });
          if (activeRevision !== revision || selected !== video) return;
          if (result.error) {
            stopMedia();
            return;
          }
          videoInfo = result.video;
          // Queue metadata without waiting for captions or pixel capture.
          send({type:'web-metadata', video:videoInfo, text:address.text}).then(result => report(result.error ? 'model-error' : result.ok ? 'saved' : 'hidden'));
          mediaSince = Date.now();
          const options = { ...settings,...(settings.lightMode?{scenesEnabled:false,screenTextEnabled:false}:{}), dwellSeconds: Math.min(5, Number(settings.dwellSeconds) || 5) };
          globalThis.__recallScenes?.start(clock, options);
          globalThis.__recallScreen?.start(clock, options);
          const jump = new URLSearchParams(location.hash.slice(1)), time = Number(jump.get("recall-time"));
          if (jump.has("recall-time") && Number.isFinite(time) && time >= 0 && (!jump.has("recall-media") || jump.get("recall-media") === videoInfo.mediaKey)) {
            try {
              video.currentTime = time;
            } catch {
            }
          }
        }
      }
      if (videoInfo && selected && Date.now() - mediaSince >= 5e3) {
        const segments = [];
        for (const track of selected.textTracks) for (const cue of [...track.activeCues || []]) {
          const key = cue.startTime + ":" + cue.text;
          if (!cuesSeen.has(key)) {
            segments.push({ start: cue.startTime, text: String(cue.text).replace(/<[^>]*>/g, " ").slice(0, 2e3) });
            cuesSeen.add(key);
          }
        }
        if (cuesSeen.size > 1e3) cuesSeen = new Set([...cuesSeen].slice(-500));
        if (segments.length) {
          const result = await send({ type: "web-media", video: videoInfo, segments: segments.slice(0, 16) });
          report(result.error ? "model-error" : result.ok ? "saved" : "hidden");
        } else if (!settings.lightMode && config.audio && !speechAttempted && ![...selected.textTracks].some((track) => track.cues?.length)) {
          speechAttempted = true;
          await send({ type: "speech-auto-start" });
        }
      }
      if (force || Date.now() - eligibleAt >= 5e3 && Date.now() - lastChecked >= 1e4 && (!lastSaved || Date.now() - lastSaved >= 6e4)) {
        lastChecked = Date.now();
        const query = P.searchQuery(new URL(location.href)), searchPage = query !== null, text = searchPage ? "" : pageText(), title = searchPage ? query || document.title : document.title;
        if ((text !== lastText || Date.now() - lastSaved >= 6e4 || force) && (text.length >= 40 || searchPage || force)) {
          const result = await send({ type: "web-capture", kind: searchPage ? "search" : "page", url: pageUrl, title, text });
          report(result.error ? "model-error" : result.unchanged ? "duplicate" : result.ok ? "saved" : "hidden");
          if (result.ok) {
            lastText = text;
            lastSaved = Date.now();
          }
          if (force) return result;
        } else if (text.length < 40 && !searchPage && !videoInfo) report("too-short");
      }
      globalThis.__recallArticleImages?.tick({url:pageUrl,enabled:!settings.lightMode&&settings.articleImagesEnabled===true,ready:lastSaved>0,isAllowed:()=>eligible()&&!document.hidden&&!settings.lightMode&&settings.articleImagesEnabled===true}).catch(()=>{});
    } finally {
      busy = false;
    }
  }
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type === "web-context" || msg.type === "speech-context") {
      reply(clock());
      return false;
    }
    if (msg.type === "get-video") {
      reply({ video: videoInfo });
      return false;
    }
    if (msg.type === "speech-audio-open") {
      globalThis.__recallPageAudio.start(msg.id, clock).then(reply, (error) => reply({ error: error.message }));
      return true;
    }
    if (msg.type === "speech-audio-close") {
      globalThis.__recallPageAudio.stop(msg.id).then(() => reply({ ok: true }));
      return true;
    }
    if (msg.type === "index-now") {
      if (!eligible() || document.hidden) {
        reply({ ok: false, reason: "Page capture is paused, private or blocked." });
        return false;
      }
      tick(true).then((result) => reply(result || { ok: false, reason: "Capture is busy. Try again shortly." }), (error) => reply({ error: error.message }));
      return true;
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.webCapture) config = changes.webCapture.newValue || {};
    if (changes.settings) settings = changes.settings.newValue || {};
    if (!eligible() || changes.settings || changes.webCapture){stopMedia();globalThis.__recallArticleImages?.reset();}
  });
  window.addEventListener("pagehide", stopMedia);
  document.addEventListener("seeking", () => revision++, true);
  chrome.storage.local.get(["webCapture", "settings"]).then((data) => {
    config = data.webCapture || {};
    settings = data.settings || {};
    tick().catch(() => {
    });
    setInterval(() => tick().catch(() => {
    }), 1500);
  });
})();
