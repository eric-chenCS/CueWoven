import { policy, cleanItem, parseWebHistory, itemIdentity } from "./web-items.js";
import { createCaptureLog, captureReason } from "./capture-log.js";
export function createWebAccess({ chrome, engine, getSettings, requireLibrary, requirePopup = requireLibrary, onCapture=()=>{}, beforeForget = async () => {
} }) {
  const config = async () => ({ enabled: false, paused: false, allSites: false, domains: [], blocked: [], audio: false, searches:false, ...(await chrome.storage.local.get("webCapture")).webCapture });
  const log = createCaptureLog(chrome);
  async function pageStatus(tabId) {
    const tab = await chrome.tabs.get(tabId), settings = await config(), global = await getSettings(), url = policy.safeUrl(tab.url);
    if (tab.incognito) return { reason: "blocked-domain", incognito: true };
    if (!tab.url) return { reason: "no-permission" };
    if (!url || policy.matches(url.hostname, settings.blocked || [])) return { reason: "blocked-domain" };
    if (!global.enabled || !settings.enabled || settings.paused) return { reason: "paused", host: url.hostname };
    if (!policy.allowed(url.href, settings) || !await chrome.permissions.contains({ origins: [url.origin + "/*"] })) return { reason: "no-permission", host: url.hostname };
    let clock;
    try {
      clock = await chrome.tabs.sendMessage(tabId, { type: "web-context" });
    } catch {
      return { reason: "refresh-required", host: url.hostname };
    }
    if (!clock) return { reason: "refresh-required", host: url.hostname };
    if (clock.private) return { reason: "private-form", host: url.hostname };
    const identity = await itemIdentity(url.href), saved = await engine("has", { videoId: identity.videoId });
    const stored = saved.has && saved.content !== false;
    return { host: url.hostname, reason: stored ? "saved" : saved.modelStatus === "loading" ? "model-loading" : captureReason(clock.reason || "waiting"), saved: stored };
  }
  let syncing = Promise.resolve();
  function sync() {
    syncing = syncing.catch(() => {
    }).then(async () => {
      if (!chrome.scripting || !await chrome.permissions.contains({ permissions: ["scripting"] })) return;
      const old = await chrome.scripting.getRegisteredContentScripts({ ids: ["recall-web"] });
      if (old.length) await chrome.scripting.unregisterContentScripts({ ids: ["recall-web"] });
      const settings = await config();
      if (!settings.enabled || settings.paused) return;
      const granted = await chrome.permissions.getAll();
      let matches = [];
      if (settings.allSites) matches = (granted.origins || []).filter((origin) => /^https?:\/\//.test(origin) && origin !== "https://www.youtube.com/*");
      else for (const domain of settings.domains || []) for (const scheme of ["https", "http"]) {
        const origin = `${scheme}://*.${domain}/*`;
        if (await chrome.permissions.contains({ origins: [origin] })) matches.push(origin);
      }
      if (matches.length) await chrome.scripting.registerContentScripts([{ id: "recall-web", matches: [...new Set(matches)], excludeMatches: [...new Set(["*://*.youtube.com/*", ...(settings.blocked || []).map((domain) => `*://*.${domain}/*`)])], js: ["lib/web-policy.js", "lib/scene-policy.js", "content/scene-capture.js", "content/screen-capture.js", "content/speech-capture.js", "content/web-capture.js"], runAt: "document_idle", allFrames: false, persistAcrossSessions: true }]);
    });
    return syncing;
  }
  async function context(tabId, media = true) {
    const tab = await chrome.tabs.get(tabId), settings = await config(), global = await getSettings(), url = policy.safeUrl(tab.url);
    if (!global.enabled || tab.incognito || !url || !policy.allowed(url.href, settings) || !await chrome.permissions.contains({ origins: [url.protocol + "//" + url.hostname + "/*"] })) throw Error("Website capture is paused, blocked or has no site permission.");
    const clock = await chrome.tabs.sendMessage(tabId, { type: "web-context" });
    if (!clock || clock.private || media && !clock.video) throw Error("Refresh an allowed, public page with a playing video. Private pages are excluded.");
    if (media) {
      const video = await cleanItem({ ...clock.video, watchedAt: Date.now() });
      if (new URL(video.url).hostname !== url.hostname) throw Error("The video address does not belong to this site.");
      clock.video = video;
    }
    return { tab, clock, settings };
  }
  async function source(sender, media = false) {
    if (!sender.tab || sender.frameId > 0 || !policy.safeUrl(sender.url)) throw Error("Invalid website capture source.");
    const result = await context(sender.tab.id, media);
    if (new URL(result.tab.url).origin !== new URL(sender.url).origin) throw Error("The page changed.");
    return result;
  }
  async function forgetSite(domain) {
    const site = policy.domain(domain);
    if (!site) throw Error("Enter a public domain, such as example.com.");
    const settings = await config();
    await chrome.storage.local.set({ webCapture: { ...settings, blocked: [...new Set([...settings.blocked || [], site])] } });
    await beforeForget(site);
    const speech = await engine("speech-status");
    if (speech.video && (speech.video.url ? policy.matches(new URL(speech.video.url).hostname, [site]) : policy.matches("www.youtube.com", [site]) || policy.matches("youtu.be", [site]))) await engine("speech-stop", { reason: "This site was forgotten." });
    await sync();
    return engine("web-forget", { domain: site });
  }
  const handlers = {
    'capture-log-clear':async(_input,sender)=>{requireLibrary(sender);await log.clear();return {ok:true};},
    "web-page-status": async ({ tabId }, sender) => {
      requirePopup(sender);
      return pageStatus(tabId);
    },
    "capture-outcome": async ({ reason, kind, outcome }, sender) => {
      if (!sender.tab || sender.frameId > 0) throw Error("Invalid capture event.");
      const tab = await chrome.tabs.get(sender.tab.id);
      if (tab.incognito) return { ok: true };
      if (new URL(tab.url).origin !== new URL(sender.url).origin) throw Error("The page changed.");
      onCapture(tab.id,reason);
      await log.record({ host: new URL(sender.url).hostname, reason, kind, outcome });
      return { ok: true };
    },
    "web-forget-current": async ({ tabId }, sender) => {
      requirePopup(sender);
      const tab = await chrome.tabs.get(tabId), site = policy.domain(new URL(tab.url).hostname);
      if (tab.incognito || !site) throw Error("Open an allowed public site first.");
      return forgetSite(site);
    },
    "web-identify": async (input, sender) => {
      await source(sender);
      if (new URL(input.url).hostname !== new URL(sender.url).hostname) throw Error("Invalid media address.");
      let mediaKey = "";
      if (input.sourceHint) {
        if (typeof input.sourceHint !== "string" || input.sourceHint.length > 4096) throw Error("Invalid media identity.");
        const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.sourceHint));
        mediaKey = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
      }
      return { video: await cleanItem({ ...input, mediaKey, kind: "video", watchedAt: Date.now() }) };
    },
    "web-sync": async (_msg, sender) => {
      requireLibrary(sender);
      await sync();
      return { ok: true };
    },
    "web-import": async ({ items }, sender) => {
      requireLibrary(sender);
      if (!Array.isArray(items) || items.length > 32 || !items.length) throw Error("Import 1–32 history items.");
      const settings = await config(), valid = items.filter((item) => {
        const url = policy.safeUrl(item?.url);
        return url && (!policy.searchUrl(url)||settings.searches===true) && !policy.matches(url.hostname, settings.blocked || []);
      });
      if (!valid.length) return { imported: 0, skipped: items.length };
      const result = await engine("web-import", { items: valid });
      return { ...result, skipped: result.skipped + items.length - valid.length };
    },
    "web-history": async ({ days = 0 }, sender) => {
      requireLibrary(sender);
      if (![0, 30, 90, 365].includes(days)) throw Error("Invalid history range.");
      if (!await chrome.permissions.contains({ permissions: ["history"] })) throw Error("Allow browser history access first.");
      const rows = await chrome.history.search({ text: "", startTime: days ? Date.now() - days * 864e5 : 0, maxResults: 1e5 });
      const parsed = parseWebHistory({ "Browser History": rows.map((row) => ({ url: row.url, title: row.title, time_usec: row.lastVisitTime * 1e3 })) });
      return { ...parsed, limited: rows.length >= 1e5 };
    },
    "web-capture": async (input, sender) => {
      const { tab, clock,settings } = await source(sender);
      if (!tab.active || !clock.visible) return { inactive: true };
      const url = policy.safeUrl(tab.url);
      if (policy.safeUrl(input.url)?.href !== url.href || typeof input.text !== "string" || input.text.length > 6e4) throw Error("Invalid page capture.");
      if(policy.searchUrl(url)&&settings.searches!==true)return {disabled:true};
      return engine("web-capture", { kind: input.kind === "search" ? "search" : "page", url: url.href, title: policy.redactText(input.title).slice(0, 300), watchedAt: Date.now(), text: policy.redactText(input.text) });
    },
    "web-media": async (input, sender) => {
      const { tab, clock } = await source(sender, true);
      if (!tab.active || !clock.visible || clock.paused || clock.ad || clock.video.videoId !== input.video?.videoId) return { inactive: true };
      return engine("web-media", { video: clock.video, segments: input.segments });
    },
    "web-forget": async ({ domain }, sender) => {
      requireLibrary(sender);
      return forgetSite(domain);
    }
  };
  return { config, context, source, sync, handlers,pageStatus,clearLog:()=>log.clear() };
}
