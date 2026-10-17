const reasons = new Set(["saved", "duplicate", "paused", "blocked-domain", "private-form", "no-permission", "refresh-required", "hidden", "too-short", "waiting", "captions-unavailable", "model-loading", "model-error"]);
export const captureReason = (reason) => reasons.has(reason) ? reason : "model-error";
export function createCaptureLog(chrome, { now = Date.now } = {}) {
  let pending = Promise.resolve();
  return { clear() {
    pending = pending.catch(() => {
    }).then(() => chrome.storage.session?.remove("captureLog"));
    return pending;
  }, record(event) {
    if (event.incognito) return Promise.resolve();
    const safe = { time: now(), host: String(event.host || "").toLowerCase().slice(0, 253), kind: ["page", "video", "search"].includes(event.kind) ? event.kind : "page", outcome: event.outcome === "saved" ? "saved" : "skipped", reason: captureReason(event.reason) };
    if (!/^[a-z0-9.-]+$/.test(safe.host)) return Promise.resolve();
    pending = pending.catch(() => {
    }).then(async () => {
      if (!chrome.storage.session) return;
      const { captureLog = [] } = await chrome.storage.session.get("captureLog"), last = captureLog.at(-1);
      if (last && last.host === safe.host && last.kind === safe.kind && last.reason === safe.reason && safe.time - last.time < 3e4) return;
      await chrome.storage.session.set({ captureLog: [...captureLog, safe].slice(-100) });
    });
    return pending;
  } };
}
