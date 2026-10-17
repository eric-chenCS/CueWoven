import { test } from "node:test";
import assert from "node:assert/strict";
import { createCaptureLog } from "../lib/capture-log.js";
function fixture() {
  let data = {}, time = 1e5;
  const chrome = { storage: { session: { get: async () => data, set: async (value) => data = { ...data, ...value }, remove: async (key) => {
    delete data[key];
  } } } }, log = createCaptureLog(chrome, { now: () => time });
  return { log, data: () => data, advance: () => time += 31e3 };
}
test("capture diagnostics discard content and incognito; repeated reasons are throttled", async () => {
  const f = fixture();
  await f.log.record({ host: "example.com", reason: "private-form", kind: "page", text: "SECRET", url: "https://example.com/SECRET", query: "SECRET" });
  await f.log.record({ host: "example.com", reason: "private-form", kind: "page" });
  await f.log.record({ host: "private.example.com", reason: "saved", incognito: true });
  assert.equal(f.data().captureLog.length, 1);
  assert.ok(!JSON.stringify(f.data()).includes("SECRET"));
  assert.ok(!JSON.stringify(f.data()).includes("private.example"));
  f.advance();
  await f.log.record({ host: "example.com", reason: "private-form" });
  assert.equal(f.data().captureLog.length, 2);
});
test("concurrent diagnostics writes keep only the newest hundred sanitized events", async () => {
  const f = fixture();
  await Promise.all(Array.from({ length: 120 }, (_, i) => f.log.record({ host: "site" + i + ".example.com", reason: "injected reason", kind: "bad" })));
  const rows = f.data().captureLog;
  assert.equal(rows.length, 100);
  assert.equal(rows[0].host, "site20.example.com");
  assert.ok(rows.every((row) => row.reason === "model-error" && row.kind === "page"));
});
test("clearing diagnostics drains older queued events before deleting the log", async () => {
  const f = fixture(), pending = f.log.record({ host: "example.com", reason: "saved" });
  await f.log.clear();
  await pending;
  assert.equal(f.data().captureLog, void 0);
});
