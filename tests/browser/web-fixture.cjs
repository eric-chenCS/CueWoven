const { chromium } = require(process.env.RECALL_PLAYWRIGHT || "playwright"), fs = require("fs"), path = require("path"), os = require("os");
module.exports = async function fixture({ sites = ["example.com", "instagram.com", "tiktok.com"] } = {}) {
  const root = process.env.RECALL_EXTENSION || path.resolve(__dirname, "../.."), directory = fs.mkdtempSync(path.join(os.tmpdir(), "recall-web-")), extension = path.join(directory, "extension");
  fs.cpSync(root, extension, { recursive: true, filter: (source) => {
    const rel = path.relative(root, source);
    return !rel.split(path.sep).some((part) => ["node_modules", ".git"].includes(part)) && !rel.endsWith(".zip");
  } });
  const manifestPath = path.join(extension, "manifest.json"), manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.permissions = [...new Set([...manifest.permissions, "scripting", "history"])];
  manifest.optional_permissions = manifest.optional_permissions.filter((name) => !["scripting", "history"].includes(name));
  manifest.host_permissions.push(...sites.flatMap((site) => [`https://*.${site}/*`, `http://*.${site}/*`]));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const context = await chromium.launchPersistentContext(path.join(directory, "profile"), { headless: true, executablePath: process.env.RECALL_BROWSER, viewport: { width: 1e3, height: 800 }, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker"), base = `chrome-extension://${new URL(worker.url()).hostname}`, options = await context.newPage();
  await options.goto(`${base}/options/options.html`);
  const send = (msg) => options.evaluate((msg2) => chrome.runtime.sendMessage(msg2), msg), wait = async (predicate) => {
    const deadline = Date.now() + 18e4;
    do {
      const value = await predicate();
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 200));
    } while (Date.now() < deadline);
    throw Error("Web integration timed out");
  };
  const enable = async ({ audio = false, scenes = false, ocr = false } = {}) => {
    await options.evaluate(async ({ audio: audio2, scenes: scenes2, ocr: ocr2, sites: sites2 }) => {
      await chrome.storage.local.set({ webCapture: { enabled: true, allSites: false, paused: false, domains: sites2, blocked: [], audio: audio2 }, settings: { enabled: true, dwellSeconds: 0, maxAgeDays: 0, scenesEnabled: scenes2, screenTextEnabled: ocr2, speechEnabled: true } });
      const result = await chrome.runtime.sendMessage({ type: "web-sync" });
      if (result.error) throw Error(result.error);
    }, { audio, scenes, ocr, sites });
  };
  return { context, options, worker, base, send, wait, enable, close: () => context.close() };
};
