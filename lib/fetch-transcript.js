import './parse.js';
const P = globalThis.__recallParse;
const ORIGIN = 'https://www.youtube.com';
const MAX_BODY = 8 * 1024 * 1024;

// Read JSON data only; never execute scripts from a fetched page.
export function pageObjects(html, marker) {
  const objects = [];
  let attempts = 0;
  for (const match of html.matchAll(marker)) {
    if (++attempts > 20) break;
    const start = match.index + match[0].length;
    if (html[start] !== '{') continue;
    let depth = 0, quoted = false, escaped = false;
    for (let i = start; i < html.length; i++) {
      const ch = html[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') quoted = false;
      } else if (ch === '"') quoted = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        try { objects.push(JSON.parse(html.slice(start, i + 1))); } catch { /* unsupported page data */ }
        break;
      }
    }
    if (objects.length === 20) break;
  }
  return objects;
}

export async function fetchTranscript(videoId, fetcher = fetch) {
  if (!/^[\w-]{11}$/.test(videoId)) throw new Error('Invalid video ID.');
  const signal = AbortSignal.timeout(20000);
  async function body(url, options = {}) {
    const response = await fetcher(url, {...options, credentials: 'include', redirect: 'error', signal});
    if (response.status === 429) throw Object.assign(new Error('YouTube is limiting requests. Pause and try again later.'), {rateLimited: true});
    if (!response.ok) throw new Error(`YouTube returned HTTP ${response.status}.`);
    if (!response.body) return '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0, text = '';
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BODY) throw new Error('YouTube response was too large.');
        text += decoder.decode(value, {stream: true});
      }
      return text + decoder.decode();
    } finally { await reader.cancel().catch(() => {}); }
  }
  const html = await body(`${ORIGIN}/watch?v=${videoId}`);
  const player = pageObjects(html, /(?:\bytInitialPlayerResponse|window\["ytInitialPlayerResponse"\])\s*=\s*/g).find(p => p.videoDetails?.videoId === videoId);
  const details = player?.videoDetails || {};
  const video = {videoId, title: details.title || '', channel: details.author || '', lengthSeconds: Number(details.lengthSeconds) || 0};
  const track = P.pickCaptionTrack(player?.captions?.playerCaptionsTracklistRenderer?.captionTracks);
  if (track?.baseUrl) {
    const url = new URL(track.baseUrl, ORIGIN);
    if (url.origin !== ORIGIN || url.pathname !== '/api/timedtext' || url.username || url.password || url.searchParams.get('v') !== videoId) throw new Error('Invalid caption URL.');
    const jsonUrl = new URL(url);jsonUrl.searchParams.set('fmt', 'json3');
    for (const candidate of new Set([url.href, jsonUrl.href])) {
      try {
        const segments = P.parseTimedText(await body(candidate)).slice(0, 20000);
        if (segments.length >= 3) return {video, segments, method: 'background-captions'};
      } catch (error) { if (error.rateLimited || signal.aborted) throw error; }
    }
  }
  const data = pageObjects(html, /(?:\bytInitialData|window\["ytInitialData"\])\s*=\s*/g)[0];
  const params = P.findAll(data, 'getTranscriptEndpoint').map(e => e?.params).find(p => typeof p === 'string' && p.length < 20000);
  const config = Object.assign(Object.create(null), ...pageObjects(html, /\bytcfg\.set\s*\(\s*/g));
  if (params && config.INNERTUBE_CONTEXT) {
    try {
      const json = JSON.parse(await body(`${ORIGIN}/youtubei/v1/get_transcript?prettyPrint=false`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({context: config.INNERTUBE_CONTEXT, params}),
      }));
      const segments = P.parseInnertubeTranscript(json).slice(0, 20000);
      if (segments.length >= 3) return {video, segments, method: 'background-transcript-api'};
    } catch (error) { if (error.rateLimited || signal.aborted) throw error; }
  }
  throw new Error(track || params ? 'YouTube requires its player for these captions. Open the video normally, or enable fallback tabs in Settings.' : 'No accessible captions found. The title stays saved; try opening the video normally.');
}
