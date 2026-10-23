import { captureLabel } from "../lib/capture-reason.js";
import { buildReport } from "../lib/bug-report.js";
const $ = (id) => document.getElementById(id);
async function refresh() {
  try {
    const [estimate, protectedStorage, { captureLog = [] }] = await Promise.all([navigator.storage.estimate(), chrome.permissions.contains({ permissions: ["unlimitedStorage"] }), chrome.storage.session.get("captureLog")]);
    $("storage-usage").textContent = `CueWoven uses approximately ${(estimate.usage / 1024 / 1024).toFixed(1)} MB, including downloaded models. ${protectedStorage ? "Protected from normal browser quota eviction; disk space and CueWoven’s own limits still apply." : "Normal browser quota applies; export regular backups."}`;
    $("capture-events").textContent = "";
    for (const row of [...captureLog].reverse()) {
      const tr = document.createElement("tr");
      for (const text of [new Date(row.time).toLocaleTimeString(), row.host, row.kind, captureLabel(row.reason)]) {
        const cell = document.createElement("td");
        cell.textContent = text;
        tr.append(cell);
      }
      $("capture-events").append(tr);
    }
    $("capture-empty").hidden = captureLog.length > 0;
  } catch (error) {
    $("storage-usage").textContent = "Storage status unavailable: " + error.message;
  }
}
$("diagnostics-refresh").addEventListener("click", refresh);
$("diagnostics-clear").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({type:'capture-log-clear'});
  refresh();
});
// The user-agent string hides minor versions; crash triage needs the exact browser build.
async function browserVersion() {
  const ua = await navigator.userAgentData?.getHighEntropyValues(["fullVersionList", "platformVersion"]).catch(() => null);
  const brand = ua?.fullVersionList?.find((b) => b.brand === "Microsoft Edge") || ua?.fullVersionList?.find((b) => b.brand === "Chromium");
  return brand ? `${brand.brand} ${brand.version} on ${ua.platform} ${ua.platformVersion}` : navigator.userAgent;
}
async function report() {
  const [estimate, { settings }, userAgent] = await Promise.all([navigator.storage.estimate().catch(() => ({})), chrome.storage.local.get("settings"), browserVersion()]);
  const manifest = chrome.runtime.getManifest();
  return buildReport({ text: $("report-text").value, version: manifest.version_name || manifest.version, userAgent, storageMB: estimate.usage / 1024 / 1024, settings });
}
async function send(action, done) {
  try { await action(await report()); $("report-msg").textContent = done; }
  catch (error) { $("report-msg").textContent = error.message; }
}
$("report-open").addEventListener("click", () => send(({ url }) => chrome.tabs.create({ url }), "Opened GitHub. Review the report there, then submit it."));
$("report-copy").addEventListener("click", () => send(({ body }) => navigator.clipboard.writeText(body), "Report copied. Paste it into an email or a GitHub issue."));
refresh();
