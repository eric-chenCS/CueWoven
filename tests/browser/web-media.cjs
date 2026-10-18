const fixture = require("./web-fixture.cjs"), assert = require("assert/strict"), fs = require("fs"), path = require("path");
(async () => {
  const f = await fixture(), { context, options, send, wait, enable, base } = f, errors = [];
  context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
  try {
    const picture = await options.evaluate(async () => {
      const bitmap = await createImageBitmap(await (await fetch("https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/cats.png")).blob()), canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      canvas.getContext("2d").drawImage(bitmap, 0, 0, 640, 360);
      bitmap.close();
      return canvas.toDataURL("image/jpeg", 0.9);
    });
    await context.route("https://www.instagram.com/**", (route) => route.fulfill({ contentType: "text/html", body: `<!doctype html><title>Celestial chemistry</title><main><button id="play">Play</button><video width="640" height="360" muted playsinline lang="en"></video><canvas width="1280" height="720" hidden></canvas></main><script>const video=document.querySelector('video'),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),picture=new Image();picture.src=${JSON.stringify(picture)};function draw(){ctx.fillStyle='#345b78';ctx.fillRect(0,0,1280,720);if(picture.complete)ctx.drawImage(picture,0,0,1280,720);if(video.currentTime<12)return;ctx.fillStyle='#111';ctx.fillRect(80,570,1120,110);ctx.fillStyle='white';ctx.font='bold 42px Arial';ctx.fillText('The comet contains frozen water.',135,635);}setInterval(draw,100);draw();video.srcObject=canvas.captureStream(10);const track=video.addTextTrack('captions','English','en');track.mode='hidden';track.addCue(new VTTCue(0,120,'Electric current running through copper coils creates a magnetic field.'));document.querySelector('#play').onclick=()=>video.play();<\/script>` }));
    await context.route("https://www.tiktok.com/**", (route) => route.request().url().endsWith("/recall-test.wav") ? route.fulfill({ contentType: "audio/wav", body: fs.readFileSync(process.env.RECALL_SPEECH_WAV) }) : route.fulfill({ contentType: "text/html", body: `<!doctype html><title>Spoken science</title><button id="play" onclick="document.querySelector('video').play()">Play</button><video lang="en" width="640" height="360" controls loop src="/recall-test.wav"></video>` }));
    await enable({ scenes: true, ocr: true, audio: true });
    const imported = await send({ target:'offscreen',type: "web-import", items: [{ kind: "page", url: "https://www.instagram.com/reel/demo12345", title: "Celestial chemistry", watchedAt: 17e11 }] });
    assert.equal(imported.imported, 1);
    const instagram = await context.newPage();
    await instagram.goto("https://www.instagram.com/reel/demo12345");
    await instagram.locator("#play").click();
    const saved = await wait(async () => (await send({ type: "list" })).videos.find((row) => row.url?.includes("instagram.com") && row.kind === "video" && row.sceneCount > 0 && row.screenCount > 0 && row.chunkCount > 0));
    await instagram.evaluate(() => document.querySelector("video").pause());
    assert.equal((await send({ type: "speech-status" })).status, "idle", "available caption cues avoid unnecessary speech processing");
    const caption = await send({ type: "search", query: '"copper coils creates a magnetic field"', kind: "video", singleVideo: true });
    assert.equal(caption.results[0].videoId, saved.videoId);
    assert.ok(caption.results[0].matchSources.includes("Transcript"));
    assert.equal(caption.results[0].url, "https://www.instagram.com/reel/demo12345");
    const ocr = await send({ type: "search", query: '"The comet contains frozen water"', kind: "video", singleVideo: true });
    assert.equal(ocr.results[0].videoId, saved.videoId);
    assert.ok(ocr.results[0].matchSources.includes("On-screen text"));
    assert.ok(ocr.results[0].start > 0);
    const scene = await send({ type: "search", query: "two cats sitting on a sofa", kind: "video", singleVideo: true });
    assert.equal(scene.results[0].videoId, saved.videoId);
    assert.ok(scene.results[0].matchSources.includes("Scene"));
    const popup = await context.newPage();
    await popup.goto(`${base}/popup/popup.html`);
    await popup.locator("#kind-filter").selectOption("video");
    await popup.locator("#q").fill('"The comet contains frozen water"');await popup.locator("#q").press("Enter");
    await wait(async () => await popup.locator(".result").count());
    const href = await popup.locator(".result").first().getAttribute("href");
    assert.match(href, /^https:\/\/www\.instagram\.com\/reel\/demo12345#recall-time=\d+/);
    if (process.env.RECALL_SCREENSHOT_DIR) await popup.screenshot({ path: path.join(process.env.RECALL_SCREENSHOT_DIR, "recall-v3-social-video.png"), fullPage: true });
    await enable({ audio: true });
    const tiktok = await context.newPage();
    await tiktok.goto("https://www.tiktok.com/@fixture/video/12345");
    assert.equal(await tiktok.evaluate(async url=>fetch(url).then(response=>response.ok).catch(()=>false),base+'/content/speech-worklet.js'),false,'fixed extension ID cannot expose the worklet to a website');
    await tiktok.locator("#play").click();
    const heard = await wait(async () => {
      const result = await send({ type: "speech-status" });
      if (result.reason && result.status === "idle") throw Error(result.reason);
      return result.saved > 0 ? result : false;
    });
    await tiktok.evaluate(() => document.querySelector("video").pause());
    await send({ target: "offscreen", type: "speech-stop" });
    const backup = await send({ type: "export" }), audio = backup.items.find((row) => row.url.includes("tiktok.com"));
    assert.ok(audio.passages.some((row) => row.source === "Audio"));
    assert.match(audio.passages.filter((row) => row.source === "Audio").map((row) => row.text).join(" "), /battery|recall|video|charge|energy/i);
    await send({ type: "clear" });
    await options.locator("#import").setInputFiles({ name: "recall-web-video-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
    await options.waitForFunction(() => document.querySelector("#data-msg").textContent.startsWith("Imported"), null, { timeout: 18e4 });
    const after = await send({ type: "search", query: '"The comet contains frozen water"', kind: "video", singleVideo: true });
    assert.equal(after.results[0].videoId, saved.videoId);
    assert.ok(after.results[0].screenText);
    const restored = await send({ type: "export" });
    assert.equal(restored.scenes.length, backup.scenes.length);
    assert.equal(restored.items.length, backup.items.length);
    assert.deepEqual(restored.items.find((row) => row.videoId === audio.videoId).passages.filter((row) => row.source === "Audio"), audio.passages.filter((row) => row.source === "Audio"));
    assert.deepEqual(errors, []);
    console.log("WEB_MEDIA_PASS", JSON.stringify({ caption: caption.results[0].matchSources, ocr: ocr.results[0].matchSources, scene: scene.results[0].matchSources, link: href, speechSaved: heard.saved, audio: audio.passages.filter((row) => row.source === "Audio").map(({ start, text }) => ({ start, text })), backupItems: restored.items.length, scope: "Controlled Instagram/TikTok origin pages; real HTML players, CLIP, OCR, MiniLM and Whisper. Not production-platform compatibility." }));
  } finally {
    await f.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
