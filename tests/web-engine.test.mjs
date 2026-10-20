import { test } from "node:test";
import assert from "node:assert/strict";
import { createWebEngine } from "../offscreen/web-engine.js";
const input = { kind: "page", url: "https://example.com/article", title: "Public science", watchedAt: 17e11, text: "Coral reefs lose their algae when ocean temperatures become too warm." };
function fixture(embed,onChange) {
  const records = new Map(), rows = new Map(), calls = [];
  const db = { listVideos: async () => [...records.values()], getVideo: async (id) => records.get(id), touchWatch: async (id, date) => {
    records.set(id, { ...records.get(id), watchedAt: date, historyImported: false });
  }, items: { get: async (id) => rows.get(id), put: async (video, passages, options) => {
    calls.push({ video, passages, options });
    records.set(video.videoId, video);
    rows.set(video.videoId, { id: video.videoId, passages, pageFingerprint: options.pageFingerprint });
    return { ok: true, video };
  } } };
  const engine = createWebEngine({ db, embed: embed || (async (texts) => texts.map(() => new Float32Array(384))),onChange });
  return { engine, records, rows, calls,db };
}
test("unchanged page text reuses vectors, but evicted content can be indexed again", async () => {
  let embeddings = 0;
  const f = fixture(async (texts) => {
    embeddings++;
    return texts.map(() => new Float32Array(384));
  });
  await f.engine.capture(input);
  await f.engine.capture(input);
  assert.equal(embeddings, 1);
  const row = [...f.rows.values()][0];
  row.passages = row.passages.filter((p) => p.source === "Title");
  await f.engine.capture(input);
  assert.equal(embeddings, 2);
});
test('metadata reads invalidated by clear cannot resurrect old entries in memory',async()=>{const f=fixture();await f.engine.importItems([input]);const old=[...f.records.values()];let finish,calls=0;f.db.listVideos=()=>++calls===1?new Promise(resolve=>finish=()=>resolve(old)):Promise.resolve([]);const pending=f.engine.metadata();await new Promise(resolve=>setImmediate(resolve));f.engine.reset();f.records.clear();finish();assert.equal((await pending).size,0);assert.equal(calls,2);});
test('history batches embed titles together and notify the library once per completed batch',async()=>{
  const batches=[];let changes=0;
  const f=fixture(async texts=>{batches.push(texts);return texts.map(()=>new Float32Array(384))},()=>changes++);
  const rows=Array.from({length:32},(_,i)=>({...input,url:'https://example.com/article/'+i,title:'Science article '+i}));
  assert.deepEqual(await f.engine.importItems(rows),{imported:32,skipped:0});
  assert.equal(batches.length,1);assert.equal(batches[0].length,32);assert.equal(changes,1);
  assert.deepEqual(await f.engine.importItems(rows),{imported:0,skipped:32});assert.equal(batches.length,1);assert.equal(changes,1);
});
test('a changed page only embeds new passage text and preserves updated offsets and anchors',async()=>{
  const batches=[],f=fixture(async texts=>{batches.push(texts);return texts.map(()=>new Float32Array(384))});
  const first=Array.from({length:220},(_,i)=>'word'+i).join(' '),second=first.replace('word200','changed200');
  await f.engine.capture({...input,text:first});await f.engine.capture({...input,text:second});
  assert.equal(batches.length,2);assert.equal(batches[1].length,1);assert.ok(batches[1][0].includes('changed200'));assert.ok(f.calls.at(-1).passages.every(row=>typeof row.lexicalText==='string'));
});
test('canceling a batched history embedding prevents pending titles from being saved',async()=>{
  let finish,signal;const ready=new Promise(resolve=>signal=resolve),f=fixture(texts=>{signal();return new Promise(resolve=>finish=()=>resolve(texts.map(()=>new Float32Array(384))))});
  const pending=f.engine.importItems([input]);await ready;f.engine.cancel();finish();await assert.rejects(pending,/stopped/);assert.equal(f.calls.length,0);
});
test("canceling a pending page embedding prevents a later write after deletion", async () => {
  let finish, signal;
  const ready = new Promise((resolve) => signal = resolve), f = fixture((texts) => {
    signal();
    return new Promise((resolve) => finish = () => resolve(texts.map(() => new Float32Array(384))));
  });
  const pending = f.engine.capture(input);
  await ready;
  f.engine.cancel();
  finish();
  assert.deepEqual(await pending, { disabled: true });
  assert.equal(f.calls.length, 0);
});
test("web history validates the entire batch before saving and rejects malformed backup passages", async () => {
  const f = fixture();
  await assert.rejects(f.engine.importItems([input, { ...input, url: "https://mail.google.com/" }]), /private|sensitive/);
  assert.equal(f.calls.length, 0);
  await assert.rejects(f.engine.restore({ ...input, passages: [{ source: "Page text", start: 0, text: "Valid text", anchor: "x".repeat(501) }] }), /Invalid saved/);
  assert.equal(f.calls.length, 0);
});

test('video titles and post captions are searchable before any media transcript exists',async()=>{
  const f=fixture();
  f.db.items.searchScan=async visit=>{for(const row of f.rows.values())visit(row)};
  const video={...input,kind:'video',url:'https://www.instagram.com/reel/example',title:'Aurora lantern',text:''};
  await f.engine.capture(video);
  const title=await f.engine.search('"Aurora lantern"',new Float32Array(384),{kind:'video'});
  assert.equal(title.length,1);assert.equal(title[0].titleOnly,true);
  await f.engine.capture({...video,text:'Nebula journeys through the northern sky'});
  const caption=await f.engine.search('"Nebula journeys"',new Float32Array(384),{kind:'video'});
  assert.equal(caption.length,1);assert.equal(caption[0].pageText,true);assert.equal(caption[0].videoId,title[0].videoId);
});
test("backup restoration keeps original indexing dates and packed audio ranges", async () => {
  const f = fixture(), indexedAt = 1700000001e3;
  await f.engine.restore({ ...input, indexedAt, historyImported: true, kind: "video", passages: [{ source: "Audio", start: 12, text: "Words actually heard.", speechStart: 10, speechEnd: 25 }] });
  const call = f.calls[0];
  assert.equal(call.video.indexedAt, indexedAt);
  assert.equal(call.options.restore, true);
  assert.equal(call.options.imported, true);
  assert.equal(call.passages.find((p) => p.source === "Audio").speechStart, 10);
  assert.ok(call.passages.every((p) => p.vec instanceof Int8Array));
});

test('captured and restored secrets are redacted before embeddings and persistence',async()=>{
  const secret='sk-'+ 'a'.repeat(30),embeddings=[],f=fixture(async texts=>{embeddings.push(...texts);return texts.map(()=>new Float32Array(384));});
  await f.engine.capture({...input,title:'Coral '+secret,text:'Coral reefs contain algae. Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456'});
  await f.engine.restore({...input,url:'https://example.com/restored',passages:[{source:'Page text',start:0,text:'Marine science '+secret}]});
  const output=JSON.stringify({embeddings,calls:f.calls});
  assert.equal(output.includes(secret),false);assert.equal(output.includes('abcdefghijklmnopqrstuvwxyz123456'),false);
  assert.ok(output.includes('redacted'));assert.ok(embeddings.some(text=>text.includes('Coral')));
});
