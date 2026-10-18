import { policy } from "../lib/web-items.js";
import {setItemImage} from "../lib/item-image.js";
import { DEFAULT_DOMAINS, SUGGESTED_SITES, siteGroup, siteOrigins, initialSiteSettings } from "../lib/web-sites.js";
const $ = (id) => document.getElementById(id), send = (msg) => chrome.runtime.sendMessage(msg);
const ALL_ORIGINS = ["https://*/*", "http://*/*"];
let settings = { enabled: false, paused: false, domains: [...DEFAULT_DOMAINS], blocked: [] }, missing = [], refreshId = 0;

// The switch represents website saving; global auto-save and browser access are reported separately.
const isOn = () => settings.enabled === true && !settings.paused;
const listed = () => (settings.domains || []).filter((host) => !policy.matches(host, settings.blocked || []));

function siteChip(host, label, onClick) {
  const item = document.createElement("li");
  item.className = "site";
  const icon = document.createElement("img");
  icon.alt = "";
  icon.width = icon.height = 16;
  setItemImage(icon, {kind:"page",url:`https://${host}/`});
  const name = document.createElement("span");
  name.textContent = host;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "site-remove";
  button.textContent = "×";
  button.setAttribute("aria-label", `${label} ${host}`);
  button.title = `${label} ${host}`;
  button.addEventListener("click", () => run(onClick));
  item.append(icon, name, button);
  return item;
}

function renderGroups(container, groups, label, onClick) {
  container.textContent = "";
  for (const [title, hosts] of groups) {
    if (!hosts.length) continue;
    const group = document.createElement("div");
    group.className = "site-group";
    group.dataset.group = title;
    const heading = document.createElement("h3");
    heading.textContent = title;
    const list = document.createElement("ul");
    list.className = "sites";
    list.setAttribute("aria-label", title);
    for (const host of hosts) list.append(siteChip(host, label, () => onClick(host)));
    group.append(heading, list);
    container.append(group);
  }
}

async function refresh() {
  const request = ++refreshId;
  const stored = await chrome.storage.local.get(["webCapture", "settings"]);
  const current = { enabled: false, paused: false, allSites: false, domains: stored.webCapture ? [] : [...DEFAULT_DOMAINS], blocked: [], ...stored.webCapture };
  const hosts = current.domains.filter((host) => !policy.matches(host, current.blocked || []));
  const [scripting, allAccess, ...siteAccess] = await Promise.all([
    chrome.permissions.contains({ permissions: ["scripting"] }),
    chrome.permissions.contains({ origins: ALL_ORIGINS }),
    ...hosts.map(async host => host === "youtube.com" || host.endsWith(".youtube.com") || (await Promise.all(["https", "http"].map(scheme => chrome.permissions.contains({ origins: [`${scheme}://*.${host}/*`] })))).some(Boolean)),
  ]);
  if (request !== refreshId) return;
  settings = current;
  const autoSave = stored.settings?.enabled !== false;
  const on = isOn();

  $("web-enabled").checked = on;
  $("web-all").checked = !!settings.allSites;
  $("web-searches").checked = settings.searches === true;
  $("web-audio").checked = !!settings.audio;
  $("web-state").textContent = !on ? "Off. No new pages are saved; existing items stay searchable."
    : !autoSave ? "Waiting: Save automatically is off in Settings."
    : settings.allSites ? "On for eligible public websites."
    : `On for ${hosts.length} ${hosts.length === 1 ? "site" : "sites"}.`;

  // The list of sites, grouped the way they were suggested.
  const groups = new Map([...Object.keys(SUGGESTED_SITES), "Added by you"].map((name) => [name, []]));
  for (const host of hosts) groups.get(siteGroup(host)).push(host);
  renderGroups($("web-sites"), groups, "Remove", removeSite);
  $("web-scope-note").hidden = !settings.allSites;
  $("web-site-count").textContent = String(hosts.length);
  const missingDefaults = DEFAULT_DOMAINS.filter((site) => !settings.domains.includes(site) && !policy.matches(site, settings.blocked || []));
  $("web-restore").hidden = !missingDefaults.length;
  $("web-restore").textContent = `Add suggested sites (${missingDefaults.length})`;
  if (!hosts.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No sites yet. Add one below.";
    $("web-sites").append(empty);
  }

  // Chrome access: only worth mentioning while saving is on.
  missing = on ? (settings.allSites ? (allAccess ? [] : ["every website"]) : hosts.filter((_, index) => !siteAccess[index])) : [];
  if (on && !scripting) missing = settings.allSites ? ["every website"] : hosts.filter(host => siteOrigins([host]).length);
  if (on && autoSave && missing.length) $("web-state").textContent = "Ready to save. Give browser access below to start on the remaining sites.";
  $("web-access-row").hidden = !missing.length;
  $("web-access").textContent = missing.length ? `The browser hasn't given CueWoven access to ${missing.length > 3 ? missing.length + " of these sites" : missing.join(", ")} yet.` : "";

  // Sites the user forgot: blocked until unblocked here.
  const blocked = settings.blocked || [];
  $("web-exclusions-help").hidden = !blocked.length;
  renderGroups($("web-exclusions"), new Map([["Excluded sites", blocked]]), "Allow again", allowSite);

  const extras = [settings.allSites && "all public sites", settings.searches && "searches", settings.audio && (stored.settings?.lightMode ? "video audio (paused by Lite mode)" : "video audio")].filter(Boolean);
  $("web-options-summary").textContent = extras.length ? "Selected: " + extras.join(", ") : "Every site, searches, video audio";
}

async function save(patch, message = "Saved.") {
  settings = { ...settings, ...patch };
  await chrome.storage.local.set({ webCapture: settings });
  const result = await send({ type: "web-sync" });
  if (result?.error) throw Error(result.error);
  await refresh();
  $("web-msg").textContent = message;
}

async function run(fn) {
  $("web-msg").textContent = "";
  try {
    await fn();
  } catch (error) {
    $("web-msg").textContent = error.message;
    await refresh().catch(() => {});
  }
}

// Ask Chrome for access. This must be the first await in a click handler.
async function requestAccess(origins) {
  if (!origins.length) return; // YouTube already has its built-in video access.
  const granted = await chrome.permissions.request({ permissions: ["scripting"], origins });
  if (!granted) throw Error("The browser didn't give access, so nothing changed.");
}
const accessFor = (domains) => settings.allSites ? ALL_ORIGINS : siteOrigins(domains);

function normalizeSite(value) {
  const site = policy.domain(value.trim());
  return site ? policy.domain(site.replace(/^www\./, "")) : null;
}
async function removeSite(host) {
  const patch = { domains: settings.domains.filter(site => site !== host) };
  patch.blocked = [...new Set([...(settings.blocked || []), host])];
  await save(patch, `Removed ${host}. It is excluded from future capture and imports. Saved items are kept.`);
}
async function allowSite(host) {
  const blockers = (settings.blocked || []).filter(site => site !== host);
  const parent = blockers.find(site => policy.matches(host, [site]));
  if (parent) throw Error(`Allow ${parent} again first; it also excludes ${host}.`);
  await requestAccess(siteOrigins([host]));
  await save({ domains: [...new Set([...settings.domains, host])], blocked: blockers }, `${host} can be saved again.`);
}

$("web-enabled").addEventListener("change", (event) => run(async () => {
  if (!event.target.checked) return save({ paused: true }, "Turned off. Pages you already saved stay searchable.");
  await requestAccess(accessFor(listed()));
  await save({ enabled: true, paused: false, domains: settings.domains }, "Turned on. Reload any open tabs on these sites.");
}));

$("web-add").addEventListener("submit", (event) => {
  event.preventDefault();
  run(async () => {
    const site = normalizeSite($("web-domain").value);
    if (!site) throw Error("Type just the site's address, like example.com. Email, banking and other private sites can't be added.");
    const host = site;
    const parent = (settings.blocked || []).find(blocked => blocked !== host && policy.matches(host, [blocked]));
    if (parent) throw Error(`Allow ${parent} again first; it also excludes ${host}.`);
    if (settings.domains.includes(host) && !policy.matches(host, settings.blocked || [])) throw Error(`${host} is already in the list.`);
    await requestAccess(siteOrigins([host]));
    await save({ domains: [...new Set([...settings.domains, host])], blocked: (settings.blocked || []).filter((blocked) => blocked !== host) }, `Added ${host}.`);
    $("web-domain").value = "";
  });
});

$("web-restore").addEventListener("click", () => run(async () => {
  const add = DEFAULT_DOMAINS.filter((site) => !settings.domains.includes(site) && !policy.matches(site, settings.blocked || []));
  await requestAccess(siteOrigins(add));
  await save({ domains: [...settings.domains, ...add] }, `Added ${add.length} suggested ${add.length === 1 ? "site" : "sites"}.`);
}));

$("web-fix").addEventListener("click", () => run(async () => {
  await requestAccess(settings.allSites ? ALL_ORIGINS : siteOrigins(missing));
  await save({}, "Access given. Reload any open tabs on these sites.");
}));

$("web-all").addEventListener("change", (event) => run(async () => {
  if (!event.target.checked) return save({ allSites: false }, "Now saving only from the sites in your list.");
  if (isOn()) await requestAccess(ALL_ORIGINS);
  await save({ allSites: true }, isOn() ? "Now saving from eligible public websites." : "Eligible public websites will be saved once you turn saving on.");
}));
$("web-searches").addEventListener("change", (event) => run(() => save({ searches: event.target.checked }, event.target.checked ? "Google searches will be saved." : "Google searches won't be saved.")));
$("web-audio").addEventListener("change", (event) => run(() => save({ audio: event.target.checked })));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.webCapture || changes.settings)) refresh().catch(() => {
  });
});
(async () => {
  const {webCapture} = await chrome.storage.local.get('webCapture');
  const initial = initialSiteSettings(webCapture);
  if (initial) await chrome.storage.local.set({webCapture:initial});
  await refresh();
})().catch(error => $("web-msg").textContent = error.message);


for (const event of [chrome.permissions.onAdded, chrome.permissions.onRemoved]) event.addListener(() => refresh().catch(error => $("web-msg").textContent = error.message));
