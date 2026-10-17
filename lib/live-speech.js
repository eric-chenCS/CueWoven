// Audio helpers are pure so timing and resampling can be checked without a browser.
export function downsample(samples, sourceRate, targetRate = 16000) {
  if (!(samples instanceof Float32Array) || !Number.isFinite(sourceRate) || sourceRate < targetRate) throw new Error('Unsupported audio samples.');
  if (sourceRate === targetRate) return samples.slice();
  const ratio = sourceRate / targetRate, out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const from = Math.floor(i * ratio), to = Math.floor((i + 1) * ratio);
    let sum = 0;for (let j = from; j < to; j++) sum += samples[j];
    out[i] = sum / (to - from);
  }
  return out;
}

// Only standalone stock filler is discarded; the same words in a sentence survive.
export function cleanSpeechText(text) {
  const cleaned=String(text || '').replace(/[\[(](?:(?:(?:upbeat|soft|background|dramatic|instrumental|sad|loud|gentle|cheerful) )?music(?: playing)?|applause|silence|inaudible|laughter|laughing|clapping)[\])]/gi,' ').replace(/\s+/g,' ').trim();
  return /^(?:thank you|thanks for watching|thank you for watching)[.!?,\s]*$/i.test(cleaned)?'':cleaned;
}
export function speechSegments(result, start, rate, duration) {
  const chunks = Array.isArray(result?.chunks) && result.chunks.length ? result.chunks : [{text: result?.text, timestamp: [0, duration]}];
  return chunks.filter(c => typeof c.text === 'string' && c.text.trim()).map(c => {
    const from = Math.max(0, Number(c.timestamp?.[0]) || 0);
    const to = Math.min(duration, Number(c.timestamp?.[1]) || duration);
    return {start: start + Math.min(from, duration) * rate, dur: Math.max(0, to - from) * rate, text: cleanSpeechText(c.text)};
  }).filter(c => c.dur > 0 && c.text);
}

// One live session, one inference at a time, and at most two queued audio windows.
export function createLiveSpeech({prepareModel, transcribe, openAudio, readClock, save, onChange = () => {}, releaseModel = () => {}}) {
  let state = {status: 'idle', saved: 0}, audio = null, parts = [], seconds = 0, rangeStart = 0, rate = 1, last = null;
  let queue = [], pumping = null, stopping = null, clockBusy = false;
  const snapshot = () => structuredClone(state);
  const publish = () => onChange(snapshot());
  function clearBuffer() {parts = [];seconds = 0;}
  function pump() {
    if (pumping) return pumping;
    pumping = (async () => {
      while (queue.length) {
        const item = queue.shift();
        let energy = 0;for (const n of item.pcm) energy += n * n;
        if (Math.sqrt(energy / item.pcm.length) < 0.002) continue;
        const result = await transcribe(item.pcm);
        const segments = speechSegments(result, item.start, item.rate, item.duration);
        if (!segments.length) continue;
        const saved = await save({video: state.video, segments, rangeStart: item.start, rangeEnd: item.start + item.duration * item.rate});
        if (saved.skipped) {state.reason = 'A caption transcript is already saved. Speech-to-text stopped.';halt();queue = [];break;}
        state.saved += segments.length;publish();
      }
    })().catch(error => {state.reason = String(error.message || error);halt();queue = [];}).finally(() => {pumping = null;if (state.status === 'stopping' && !stopping) queueMicrotask(finish);});
    return pumping;
  }
  function flush() {
    if (seconds < 1) {clearBuffer();return;}
    const pcm = new Float32Array(parts.reduce((n, p) => n + p.length, 0));let offset = 0;
    for (const part of parts) {pcm.set(part, offset);offset += part.length;}
    queue.push({pcm, start: rangeStart, rate, duration: seconds});clearBuffer();
    pump();
    if (queue.length >= 2 && state.status === 'recording') {
      state.reason = 'Speech-to-text could not keep up. Capture stopped; finishing the captured audio.';
      halt();finish();
    }
  }
  function halt() {
    if (state.status === 'recording' || state.status === 'preparing') state.status = 'stopping';
    const stream = audio;audio = null;
    if (stream) stream.close().catch(() => {});
    publish();
  }
  function finish() {
    if (stopping) return stopping;
    stopping = (async () => {
      flush();if (pumping) await pumping;
      releaseModel();state.status = 'idle';publish();
      return snapshot();
    })().finally(() => {stopping = null;});
    return stopping;
  }
  async function packet(samples, sampleRate, suppliedClock) {
    if (state.status !== 'recording') return;
    if (clockBusy) {state.reason = 'Video timing is unavailable. Capture stopped to avoid incorrect timestamps.';halt();finish();return;}
    clockBusy = true;const sessionId = state.id;
    try {
      const clock = suppliedClock || await readClock(state.tabId);
      if (state.status !== 'recording' || state.id !== sessionId) return;
      if (clock?.video?.videoId !== state.video.videoId) {state.reason = 'The video changed. Start speech-to-text again for the new video.';halt();finish();return;}
      const pcm = downsample(samples, sampleRate), duration = pcm.length / 16000;
      if (!Number.isFinite(clock.time) || !Number.isFinite(clock.rate) || clock.rate <= 0) throw new Error('Invalid playback timing.');
      const previous = last;last = clock;
      if (clock.paused || clock.seeking || clock.ad) {flush();return;}
      const start = clock.time - duration * clock.rate;
      if (start < 0) return;
      if (previous && (previous.revision !== clock.revision || previous.ad !== clock.ad) || seconds && (clock.rate !== rate || Math.abs(start - (rangeStart + seconds * rate)) > 0.75)) {flush();return;}
      if (!seconds) {rangeStart = start;rate = clock.rate;}
      parts.push(pcm);seconds += duration;
      if (seconds >= 15) flush();
    } catch (error) {state.reason = String(error.message || error);halt();finish();}
    finally {clockBusy = false;}
  }
  return {
    status: snapshot,
    async prepare({tabId, video}) {
      if (state.status !== 'idle') throw new Error('Speech-to-text is already active.');
      clearBuffer();last = null;queue = [];state = {id: crypto.randomUUID(), status: 'preparing', tabId, video, saved: 0, progress: 0};publish();
      const id = state.id;
      try {
        await prepareModel(progress => {if (state.id === id && state.status === 'preparing' && Math.round(progress * 100) !== Math.round(state.progress * 100)) {state.progress = progress;publish();}});
        if (state.id !== id || state.status !== 'preparing') throw new Error('Speech-to-text was cancelled.');
        return snapshot();
      } catch (error) {if (state.id === id && state.status === 'preparing') {state.reason = error.message;state.status = 'idle';releaseModel();publish();}throw error;}
    },
    async start({id}) {
      if (state.id !== id || state.status !== 'preparing') throw new Error('Speech-to-text was cancelled.');
      const stream = await openAudio();
      if (state.id !== id || state.status !== 'preparing') {await stream.close();throw new Error('Speech-to-text was cancelled.');}
      audio = stream;state.status = 'recording';publish();return snapshot();
    },
    async stop(reason) {
      if (state.status === 'idle') return snapshot();
      if (reason) state.reason = reason;
      halt();return finish();
    },
    // Also used by synthetic audio regression tests.
    packet,
  };
}
