import { parseWebHistory, policy } from "../lib/web-items.js";
import { beginLibraryTask, libraryBusy, onLibraryBusy } from "../lib/library-busy.js";
const $ = (id) => document.getElementById(id), send = (msg) => chrome.runtime.sendMessage(msg);
let settings = {}, busy = false, stopping = false, refreshId = 0;
async function refresh() {
  const request = ++refreshId;
  const stored = await chrome.storage.local.get(["webCapture", "settings"]);
  const current = { enabled: false, paused: false, domains: [], blocked: [], ...stored.webCapture };
  const domains = current.domains.filter(host => !(current.blocked || []).some(blocked => host === blocked || host.endsWith("." + blocked)));
  const [scripting, allAccess, ...siteAccess] = await Promise.all([
    chrome.permissions.contains({ permissions: ["scripting"] }),
    chrome.permissions.contains({ origins: ["https://*/*", "http://*/*"] }),
    ...domains.map(async host => (await Promise.all(["https", "http"].map(scheme => chrome.permissions.contains({ origins: [`${scheme}://*.${host}/*`] })))).some(Boolean)),
  ]);
  if (request !== refreshId) return;
  settings = current;
  const saving = stored.settings?.enabled !== false;
  const state = !settings.enabled ? "Off" : settings.paused ? "Paused" : !saving ? "Paused by Save automatically" : "On";
  const mode = settings.allSites ? "All public sites" : "Selected sites";
  $("web-audio").checked = !!settings.audio;
  $("web-searches").checked = settings.searches === true;
  $("web-pause").disabled = !settings.enabled;
  $("web-pause").textContent = settings.paused ? "Resume" : "Pause";
  $("web-pause").setAttribute("aria-pressed", String(settings.enabled && settings.paused));
  $("web-off").disabled = !settings.enabled;
  $("web-off").setAttribute("aria-pressed", String(!settings.enabled));
  $("web-all").setAttribute("aria-pressed", String(!!settings.allSites));
  $("web-state").textContent = `Website capture: ${state}. Selected access: ${mode.toLowerCase()}.`;
  const missing = domains.filter((_, index) => !siteAccess[index]);
  $("web-access").textContent = settings.allSites
    ? "Allowed scope: all eligible public websites. Private-page checks and excluded sites still apply." + (!allAccess ? " Full browser permission is missing; only sites with granted access can be captured." : "")
    : "Allowed sites: " + (domains.length ? domains.join(", ") + " (including subdomains)." : "None. Add a site below.") + (missing.length ? " Browser permission missing: " + missing.join(", ") + ". Allow these sites again." : "");
  if (!scripting && settings.enabled) $("web-access").textContent += " Browser scripting permission is missing; allow site access again.";
  const audio = settings.audio ? (stored.settings?.lightMode ? "On (paused by Lite mode)" : "On") : "Off";
  $("web-features").textContent = `Google search queries: ${settings.searches ? "On" : "Off"}. Video audio: ${audio}.`;
  $("web-options-summary").textContent = `${state} · ${mode} · Queries ${settings.searches ? "on" : "off"} · Audio ${settings.audio ? "on" : "off"}`;
  $("web-exclusions").textContent = settings.blocked?.length ? "Sites you excluded: " + settings.blocked.join(", ") : "No additional excluded sites.";
}
async function save(patch) {
  settings = { ...settings, ...patch };
  await chrome.storage.local.set({ webCapture: settings });
  const result = await send({ type: "web-sync" });
  if (result.error) throw Error(result.error);
  await refresh();
  $("web-msg").textContent = "Saved. Refresh existing website tabs to attach Recall.";
}
function action(id, fn) {
  $(id).addEventListener("click", async () => {
    try {
      await fn();
    } catch (error) {
      $("web-msg").textContent = error.message;
    }
  });
}
action("welcome-web", async () => $("web-history-file").click());
action("web-allow", async () => {
  const site = policy.domain($("web-domain").value.trim());
  if (!site) throw Error("Enter a public domain, such as wikipedia.org. Sensitive sites stay excluded.");
  const granted = await chrome.permissions.request({ permissions: ["scripting"], origins: [`https://*.${site}/*`, `http://*.${site}/*`] });
  if (!granted) throw Error("Site access was not granted. Nothing changed.");
  await save({ enabled: true, paused: false, domains: [...new Set([...settings.domains || [], site])], blocked: (settings.blocked || []).filter((host) => host !== site) });
});
action("web-all", async () => {
  const granted = await chrome.permissions.request({ permissions: ["scripting"], origins: ["https://*/*", "http://*/*"] });
  if (!granted) throw Error("Website access was not granted. Nothing changed.");
  await save({ enabled: true, paused: false, allSites: true });
});
action("web-pause", () => save({ paused: !settings.paused }));
action("web-off", () => save({ enabled: false, paused: true }));
action("web-forget", async () => {
  const domain = policy.domain($("web-domain").value.trim());
  if (!domain) throw Error("Enter the domain to forget.");
  const result = await send({ type: "web-forget", domain });
  if (result.error) throw Error(result.error);
  await refresh();
  $("web-msg").textContent = `Forgot ${result.removed} saved items from ${domain}. Future capture and imports from this site are blocked.`;
  chrome.runtime.sendMessage({ type: "index-changed" }).catch(() => {
  });
});
$("web-audio").addEventListener("change", () => save({ audio: $("web-audio").checked }).catch((error) => $("web-msg").textContent = error.message));
async function importItems(items, description = "", videos = []) {
  if (busy || libraryBusy()) return;
  const release = beginLibraryTask();
  busy = true;
  stopping = false;
  $("web-history-stop").hidden = false;
  $("web-history-stop").textContent = "Pause after this batch";
  let imported = 0, skipped = 0, processed = 0, total = items.length + videos.length;
  try {
    const blocked = settings.blocked || [];
    if (policy.matches("www.youtube.com", blocked) || policy.matches("youtu.be", blocked)) videos = [];
    const entries = [...videos.map((video) => ({ video })), ...items.filter((item) => !policy.matches(new URL(item.url).hostname, blocked)).map((item) => ({ item }))];
    total = entries.length;
    for (let i = 0; i < entries.length && !stopping; i += 16) {
      $("web-import-msg").textContent = `Importing ${processed}/${total} titles and queries… Keep this page open. First use downloads the search model.`;
      const batch = entries.slice(i, i + 16), youtube = batch.filter((row) => row.video).map((row) => row.video), web = batch.filter((row) => row.item).map((row) => row.item);
      const results = [];
      if (youtube.length) results.push(await send({ type: "import-history", videos: youtube }));
      if (web.length) results.push(await send({ type: "web-import", items: web }));
      const failure = results.find((result2) => result2.error);
      if (failure) throw Error(failure.error);
      const result = { imported: results.reduce((n, row) => n + row.imported, 0), skipped: results.reduce((n, row) => n + row.skipped, 0) };
      if (result.error) throw Error(result.error);
      imported += result.imported;
      skipped += result.skipped;
      processed += batch.length;
    }
    $("web-import-msg").textContent = `${stopping ? "Paused" : "Done"}: ${imported} saved; ${skipped} already present. ${processed}/${total} processed. ${description} Past page bodies and video media are not fetched. Re-importing safely resumes.`;
    await chrome.storage.local.set({ onboardingComplete: true });
    chrome.runtime.sendMessage({ type: "index-changed" }).catch(() => {
    });
  } catch (error) {
    $("web-import-msg").textContent = `Stopped after ${processed}/${total}; completed items remain saved. ${error.message}`;
  } finally {
    busy = false;
    $("web-history-stop").hidden = true;
    release();
  }
}
$("web-history-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file || busy) return;
  try {
    if (file.size > 100 * 1024 * 1024) throw Error("Choose an extracted JSON file up to 100 MB.");
    let json;
    try {
      json = JSON.parse(await file.text());
    } catch {
      throw Error("Choose JSON, not HTML, in Google Takeout.");
    }
    const parsed = parseWebHistory(json);
    if (!parsed.items.length && !parsed.videos.length) throw Error("No eligible page, video or search records found.");
    await importItems(parsed.items, `${parsed.skipped} unsupported/sensitive records skipped; YouTube titles are included. Use Fetch missing transcripts for their captions.`, parsed.videos);
  } catch (error) {
    $("web-import-msg").textContent = error.message;
  }
});
$("web-history-scan").addEventListener("click", async () => {
  if (busy) return;
  try {
    const granted = await chrome.permissions.request({ permissions: ["history"] });
    if (!granted) throw Error("History access was not granted.");
    $("web-import-msg").textContent = "Reading local browser history…";
    const result = await send({ type: "web-history", days: Number($("web-history-days").value) });
    if (result.error) throw Error(result.error);
    await importItems(result.items, result.limited ? "Only the most recent 100,000 browser records were returned. Use Takeout for older records." : "", result.videos);
  } catch (error) {
    $("web-import-msg").textContent = error.message;
  }
});
$("web-history-stop").addEventListener("click", () => {
  stopping = true;
  $("web-history-stop").textContent = "Finishing this batch…";
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.webCapture || changes.settings)) refresh().catch(() => {
  });
});
onLibraryBusy(() => {
  for (const id of ["web-history-file", "web-history-scan", "web-forget", "welcome-web"]) $(id).disabled = libraryBusy();
});
refresh().catch((error) => $("web-msg").textContent = error.message);

$("web-searches").addEventListener("change",()=>save({searches:$("web-searches").checked}).catch(error=>$("web-msg").textContent=error.message));

for (const event of [chrome.permissions.onAdded, chrome.permissions.onRemoved]) event.addListener(() => refresh().catch(error => $("web-msg").textContent = error.message));
