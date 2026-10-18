// Opt-in top-frame capture; form values, private pages and other tabs are excluded.
(function() {
  if (globalThis.__recallWebCapture || chrome.extension?.inIncognitoContext) return;
  globalThis.__recallWebCapture = true;
  const P = globalThis.__recallWebPolicy, send = (msg) => chrome.runtime.sendMessage(msg).catch((error) => ({ error: error.message }));
  let config = {}, settings = {}, selected = null, selectedSrc = "", videoInfo = null, revision = 0, busy = false, pageUrl = "", eligibleAt = Date.now(), lastText = "", lastSaved = 0, lastChecked = 0, mediaSince = 0, speechAttempted = false, cuesSeen = new Set();

  // --- SECURITY SANITIZER START ---
  const SECRET_PATTERNS = [
    { name: "API_KEY", regex: /\b(?:sk-[a-zA-Z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{36,}|AKIA[0-9A-Z]{16}|xox[baprs]-[0-9a-zA-Z-]{10,}|AIza[0-9A-Za-z-_]{35}|(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{24,})\b/g },
    { name: "JWT", regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
    { name: "PRIVATE_KEY", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
    { name: "AUTH_TOKEN", regex: /\b(?:Bearer|Authorization|api[_-]?key|secret|password)\s*[:=]\s*["']?[A-Za-z0-9_\-\.~+/]{12,}["']?/gi },
    { name: "SSN", regex: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g },
    { name: "CREDIT_CARD", regex: /\b(?:\d[ -]*?){13,19}\b/g }
  ];

  function isValidCreditCard(numStr) {
    const digits = numStr.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0, shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits.charAt(i), 10);
      if (shouldDouble && (digit *= 2) > 9) digit -= 9;
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  function sanitizeText(rawText) {
    if (!rawText || typeof rawText !== "string") return "";
    let cleaned = rawText;
    for (const { name, regex } of SECRET_PATTERNS) {
      if (name === "CREDIT_CARD") {
        cleaned = cleaned.replace(regex, (m) => isValidCreditCard(m) ? `[REDACTED_${name}]` : m);
      } else {
        cleaned = cleaned.replace(regex, `[REDACTED_${name}]`);
      }
    }
    return cleaned;
  }

  function sanitizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return "";
    try {
      const parsed = new URL(rawUrl);
      const sensitiveParam = /^(token|access_token|id_token|refresh_token|code|state|session|session_id|key|api_key|auth|sig|signature|password|secret)$/i;
      for (const key of [...parsed.searchParams.keys()]) {
        if (sensitiveParam.test(key)) parsed.searchParams.set(key, "REDACTED");
      }
      if (parsed.hash && /(access_token|id_token|token|key|secret)=/i.test(parsed.hash)) {
        parsed.hash = "";
      }
      return parsed.toString();
    } catch {
      return rawUrl;
    }
  }
  globalThis.__recallSanitizer = { sanitizeText, sanitizeUrl };
  // --- SECURITY SANITIZER END ---

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
    if ([...document.querySelectorAll('input[type="password"],input[autocomplete="current-password"],input[autocomplete="new-password"],input[autocomplete^="cc-"]')].some(rendered)) return true;
    return [...document.querySelectorAll('[contenteditable]:not([contenteditable="false"]),textarea')].slice(0, 100).some((editor) => {
      if (!rendered(editor)) return false;
      const rect = editor.getBoundingClientRect(), width = Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left)), height = Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top));
      return width * height >= innerWidth * innerHeight * 0.5;
    });
  }
  const eligible = () => settings.enabled !== false && P.allowed(location.href, config) && !privatePage();
  function visible(video) {
    const rect = video.getBoundingClientRect();
    return rect.width > 40 && rect.height > 30 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth && getComputedStyle(video).visibility !== "hidden";
  }
  function choose() {
    return [...document.querySelectorAll("video")].slice(0, 30).filter((v) => !v.paused && !v.ended && v.readyState >= 2 && visible(v)).sort((a, b) => {
      const area = (v) => {
        const r = v.getBoundingClientRect();
        return Math.min(r.right, innerWidth) - Math.max(r.left, 0) > 0 ? (Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) * Math.min(r.width, innerWidth) : 0;
      };
      return area(b) - area(a);
    })[0] || null;
  }
  function clock() {
    const current = eligible(), same = selected && selected.currentSrc === selectedSrc;
    return { private: !current, video: current && same ? videoInfo : null, time: selected?.currentTime, paused: !current || !same || !selected || selected.paused, visible: current && !document.hidden && (!selected || visible(selected)), seeking: !!selected?.seeking, rate: selected?.playbackRate || 1, ad: !!selected?.closest('.ad-showing,.ad-interrupting,[data-ad="true"]'), revision, forced: false };
  }
  globalThis.__recallMediaElement = () => selected;
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
    const post = video.closest('article,[data-e2e="feed-video"]'), links = post ? [...post.querySelectorAll("a[href]")].slice(0, 100) : [];
    const direct = links.map((a) => P.safeUrl(a.href)).find((url2) => url2?.hostname === location.hostname && /\/(?:reels?|p|video|videos|status)\/[\w-]+/.test(url2.pathname));
    const canonical = P.safeUrl(document.querySelector('link[rel="canonical"]')?.href || "");
    const url = direct || (canonical?.hostname === location.hostname && /\/(?:reels?|p|video|videos|status)\/[\w-]+/.test(canonical.pathname) ? canonical : P.safeUrl(location.href));
    const stable = /\/(?:reels?|p|video|videos|status)\/[\w-]+/.test(url.pathname);
    let sourceHint = "";
    if (!stable) {
      try {
        const src = new URL(video.currentSrc, location.href);
        sourceHint = src.origin + src.pathname;
      } catch {
        sourceHint = video.currentSrc.slice(0, 4096);
      }
    }
    const rawTitle = (video.getAttribute("aria-label") || post?.querySelector("h1,h2,h3")?.textContent || document.querySelector('meta[property="og:title"]')?.content || document.title || location.hostname).trim().slice(0, 300);
    return { url: sanitizeUrl(url.href), sourceHint, title: sanitizeText(rawTitle) };
  }
  function pageText() {
    const candidates = [...document.querySelectorAll('article,main,[role="main"]')].slice(0, 16).filter(rendered);
    const root = candidates.sort((a, b) => (b.innerText?.length || 0) - (a.innerText?.length || 0))[0] || document.body;
    if (!root) return "";
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), parts = [];
    let count = 0, words = 0, node;
    while ((node = walker.nextNode()) && count++ < 8e3 && words < 2e3) {
      const parent = node.parentElement;
      if (!parent || parent.closest('script,style,noscript,nav,header,footer,aside,form,input,textarea,select,button,[hidden],[aria-hidden="true"],[data-private],[data-recall-private],.password,.secret,.token,[contenteditable]:not([contenteditable="false"])') || !rendered(parent)) continue;
      const style = getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const text = node.textContent.replace(/\s+/g, " ").trim();
      if (!text) continue;
      const list = text.split(" ").slice(0, 2e3 - words);
      words += list.length;
      parts.push(list.join(" "));
    }
    return sanitizeText(parts.join("\n").slice(0, 6e4));
  }
  async function tick(force = false) {
    if (busy) return;
    busy = true;
    try {
      const rawSafeUrl = P.safeUrl(location.href)?.href;
      const url = rawSafeUrl ? sanitizeUrl(rawSafeUrl) : "";
      if (url !== pageUrl) {
        stopMedia();
        pageUrl = url || "";
        eligibleAt = Date.now();
        lastText = "";
        lastSaved = 0;
        lastChecked = 0;
      }
      if (document.hidden || !eligible()) {
        stopMedia();
        eligibleAt = Date.now();
        return;
      }
      const video = choose();
      if (video !== selected || video && video.currentSrc !== selectedSrc) {
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
          mediaSince = Date.now();
          const options = { ...settings, dwellSeconds: Math.min(5, Number(settings.dwellSeconds) || 5) };
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
            const cleanCueText = sanitizeText(String(cue.text).replace(/<[^>]*>/g, " ").slice(0, 2e3));
            segments.push({ start: cue.startTime, text: cleanCueText });
            cuesSeen.add(key);
          }
        }
        if (cuesSeen.size > 1e3) cuesSeen = new Set([...cuesSeen].slice(-500));
        if (segments.length) await send({ type: "web-media", video: videoInfo, segments: segments.slice(0, 16) });
        else if (config.audio && !speechAttempted && ![...selected.textTracks].some((track) => track.cues?.length)) {
          speechAttempted = true;
          await send({ type: "speech-auto-start" });
        }
      }
      if (force || Date.now() - eligibleAt >= 5e3 && Date.now() - lastChecked >= 1e4 && (!lastSaved || Date.now() - lastSaved >= 6e4)) {
        lastChecked = Date.now();
        const google = /^(?:www\.)?google\.[a-z.]+$/i.test(location.hostname) && location.pathname === "/search", text = google ? "" : pageText(), rawTitle = google ? new URL(location.href).searchParams.get("q") || document.title : document.title;
        const title = sanitizeText(rawTitle);
        if ((text !== lastText || Date.now() - lastSaved >= 6e4 || force) && (text.length >= 40 || google || force)) {
          const result = await send({ type: "web-capture", kind: google ? "search" : "page", url: pageUrl, title, text });
          if (result.ok) {
            lastText = text;
            lastSaved = Date.now();
          }
          if (force) return result;
        }
      }
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
    if (!eligible()) stopMedia();
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