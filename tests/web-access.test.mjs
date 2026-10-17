import { test } from "node:test";
import assert from "node:assert/strict";
import { createWebAccess } from "../lib/web-access.js";
function fixture() {
  let config = { enabled: true, domains: ["example.com"], blocked: [] }, permission = true, tab = { id: 1, url: "https://www.example.com/article", active: true, incognito: false }, clock = { private: false, visible: true }, calls = [];
  const chrome = { storage: { local: { get: async () => ({ webCapture: config }), set: async (data) => {
    config = data.webCapture;
  } } }, permissions: { contains: async () => permission, getAll: async () => ({ origins: ["https://*.example.com/*"] }) }, tabs: { get: async () => tab, sendMessage: async () => clock }, scripting: { getRegisteredContentScripts: async () => [], registerContentScripts: async (value) => calls.push(value), unregisterContentScripts: async () => {
  } } };
  const access = createWebAccess({ chrome, engine: async (type, data) => {
    calls.push({ type, data });
    return type === "speech-status" ? { status: "idle" } : { imported: data?.items?.length || 0, skipped: 0, removed: 1 };
  }, getSettings: async () => ({ enabled: true }), requireLibrary: (sender) => {
    if (sender.url !== "library") throw Error("Library only");
  } });
  return { access, calls, tab, clock, config, deny() {
    permission = false;
  }, sender: { tab: { id: 1 }, url: tab.url, frameId: 0 } };
}
test("web capture enforces permission, incognito, private-page and user-pause boundaries", async () => {
  const f = fixture();
  await f.access.context(1, false);
  f.tab.incognito = true;
  await assert.rejects(f.access.context(1, false), /paused|blocked/);
  f.tab.incognito = false;
  f.clock.private = true;
  await assert.rejects(f.access.context(1, false), /Private/);
  f.clock.private = false;
  f.config.paused = true;
  await assert.rejects(f.access.context(1, false), /paused/);
  f.config.paused = false;
  f.deny();
  await assert.rejects(f.access.context(1, false), /permission/);
});
test("only explicitly allowed sites receive generic scripts, excluding YouTube and child frames", async () => {
  const f = fixture();
  await f.access.sync();
  const script = f.calls[0][0];
  assert.deepEqual(script.matches, ["https://*.example.com/*", "http://*.example.com/*"]);
  assert.deepEqual(script.excludeMatches, ["*://*.youtube.com/*"]);
  assert.equal(script.allFrames, false);
  assert.ok(script.js.includes("content/web-capture.js"));
  f.config.paused = true;
  f.calls.length = 0;
  await f.access.sync();
  assert.equal(f.calls.length, 0);
});
test("page capture rejects forged URLs, hidden tabs and frame messages before storing text", async () => {
  const f = fixture(), input = { url: f.tab.url, title: "An article", text: "Public article text" };
  await assert.rejects(f.access.handlers["web-capture"]({ ...input, url: "https://other.example.com/" }, f.sender), /Invalid page/);
  f.tab.active = false;
  assert.deepEqual(await f.access.handlers["web-capture"](input, f.sender), { inactive: true });
  f.tab.active = true;
  await assert.rejects(f.access.handlers["web-capture"](input, { ...f.sender, frameId: 2 }), /Invalid/);
  assert.equal(f.calls.length, 0);
});
test("history and forgetting controls require the library; excluded domains cannot be reimported", async () => {
  const f = fixture();
  await assert.rejects(f.access.handlers["web-import"]({ items: [] }, { url: "page" }), /Library/);
  f.config.blocked = ["example.com"];
  assert.deepEqual(await f.access.handlers["web-import"]({ items: [{ url: "https://example.com/a" }] }, { url: "library" }), { imported: 0, skipped: 1 });
  assert.equal(f.calls.length, 0);
});
test('popup page status distinguishes paused, excluded, private and missing permission',async()=>{const f=fixture(),sender={url:'library'};await assert.rejects(f.access.handlers['web-page-status']({tabId:1},{url:'page'}),/Library/);f.config.paused=true;assert.equal((await f.access.handlers['web-page-status']({tabId:1},sender)).reason,'paused');f.config.paused=false;f.clock.private=true;assert.equal((await f.access.handlers['web-page-status']({tabId:1},sender)).reason,'private-form');f.clock.private=false;f.config.blocked=['example.com'];assert.equal((await f.access.handlers['web-page-status']({tabId:1},sender)).reason,'blocked-domain');f.config.blocked=[];f.deny();assert.equal((await f.access.handlers['web-page-status']({tabId:1},sender)).reason,'no-permission');});
test('capture diagnostics reject iframe and forged origins and ignore incognito',async()=>{const f=fixture();await assert.rejects(f.access.handlers['capture-outcome']({}, {...f.sender,frameId:1}),/Invalid/);await assert.rejects(f.access.handlers['capture-outcome']({}, {...f.sender,url:'https://other.example.com/'}),/changed/);f.tab.incognito=true;assert.deepEqual(await f.access.handlers['capture-outcome']({},f.sender),{ok:true});});
