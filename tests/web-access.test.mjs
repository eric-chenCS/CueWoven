import { test } from "node:test";
import assert from "node:assert/strict";
import { createWebAccess } from "../lib/web-access.js";
import {cleanItem} from '../lib/web-items.js';
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

test('video metadata is saved without captions and is bound to permitted active playback',async()=>{
  const f=fixture(), video=await cleanItem({kind:'video',url:f.tab.url,title:'Reel title',watchedAt:Date.now()});
  f.clock.video=video;f.clock.paused=false;
  const input={video,text:'Post caption contact me at test@example.com'};
  await f.access.handlers['web-metadata'](input,f.sender);
  assert.equal(f.calls[0].type,'web-capture');assert.equal(f.calls[0].data.kind,'video');assert.match(f.calls[0].data.text,/\[email redacted\]/);
  for(const key of ['paused','ad']){f.clock[key]=true;assert.equal((await f.access.handlers['web-metadata'](input,f.sender)).inactive,true);f.clock[key]=false;}
  f.tab.active=false;assert.equal((await f.access.handlers['web-metadata'](input,f.sender)).inactive,true);f.tab.active=true;
  assert.equal((await f.access.handlers['web-metadata']({...input,video:{videoId:'wrong'}},f.sender)).inactive,true);
  await assert.rejects(f.access.handlers['web-metadata']({...input,text:'x'.repeat(4001)},f.sender),/Invalid/);
  f.clock.private=true;await assert.rejects(f.access.handlers['web-metadata'](input,f.sender),/Private/);
  assert.equal(f.calls.length,1);
});

const articleJpeg='data:image/jpeg;base64,'+Buffer.from([255,216,255,192,0,17,8,0,180,1,64,3,1,17,0,2,17,0,3,17,0]).toString('base64');
test('article images are tied to an allowed visible page, fresh timestamp and bounded JPEG',async()=>{
 const f=fixture(),input={url:f.tab.url,image:articleJpeg,caption:'A public figure',capturedAt:Date.now()};
 await f.access.handlers['web-image'](input,f.sender);assert.equal(f.calls[0].type,'article-image');
 await assert.rejects(f.access.handlers['web-image']({...input,url:'https://www.example.com/other'},f.sender),/Invalid/);
 await assert.rejects(f.access.handlers['web-image']({...input,capturedAt:0},f.sender),/Invalid/);
 await assert.rejects(f.access.handlers['web-image']({...input,image:'https://example.com/a.jpg'},f.sender),/Invalid/);
 await assert.rejects(f.access.handlers['web-image']({...input,caption:'x'.repeat(601)},f.sender),/Invalid/);
 await assert.rejects(f.access.handlers['web-image'](input,{...f.sender,frameId:1}),/Invalid/);
 f.tab.active=false;assert.equal((await f.access.handlers['web-image'](input,f.sender)).inactive,true);
 f.tab.active=true;f.clock.private=true;await assert.rejects(f.access.handlers['web-image'](input,f.sender),/Private/);
});
test('article-image messages have a bounded per-tab capture budget',async()=>{
 const f=fixture(),input={url:f.tab.url,image:articleJpeg,caption:'A figure',capturedAt:Date.now()};
 for(let i=0;i<3;i++)await f.access.handlers['web-image'](input,f.sender);
 assert.equal((await f.access.handlers['web-image'](input,f.sender)).rateLimited,true);
 assert.equal(f.calls.length,3);
});
