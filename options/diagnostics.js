import { captureLabel } from "../lib/capture-reason.js";
const $ = (id) => document.getElementById(id);
async function refresh() {
  try {
    const [estimate, protectedStorage, { captureLog = [] }] = await Promise.all([navigator.storage.estimate(), chrome.permissions.contains({ permissions: ["unlimitedStorage"] }), chrome.storage.session.get("captureLog")]);
    $("storage-usage").textContent = `WebLapse uses approximately ${(estimate.usage / 1024 / 1024).toFixed(1)} MB, including downloaded models. ${protectedStorage ? "Protected from normal browser quota eviction; disk space and WebLapse’s own limits still apply." : "Normal browser quota applies; export regular backups."}`;
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
refresh();
