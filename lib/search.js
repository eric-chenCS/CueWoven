// Vector search over normalized embeddings, with a light keyword boost so an
// exact word from the query nudges a chunk up without overriding meaning.

const STOP = new Set(
  ('the a an and or but of to in on at for with about from by is are was were be been it this that these those ' +
    'video videos where what when who how why guy girl someone talk talks talked talking explain explains explained ' +
    'thing things one said says say some there their they them he she his her you your i me my we our').split(' ')
);

export function queryTerms(query) {
  return Array.from(
    new Set(
      String(query || '')
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9'-]*/g) || []
    )
  ).filter((t) => t.length >= 3 && !STOP.has(t));
}

export function dot(a, b, offsetB = 0) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[offsetB + i];
  return s;
}

/**
 * @param {Float32Array} q             normalized query vector (dim D)
 * @param {{matrix:Float32Array, dim:number, meta:{videoId:string,start:number,text:string}[]}} index
 * @param {Map<string, object>} videos videoId -> video record
 * @param {{query?:string, limit?:number, perVideo?:number, sinceMs?:number, minScore?:number, offset?:number}} opts
 */
export function rank(q, index, videos, opts = {}) {
  const { matrix, dim, meta } = index;
  const limit = opts.limit ?? 12;
  const perVideo = opts.perVideo ?? 2;
  const offset = Number.isSafeInteger(opts.offset) && opts.offset >= 0 ? opts.offset : 0;
  const sinceMs = opts.sinceMs ?? 0;
  const minScore = opts.minScore ?? 0.15;
  const terms = queryTerms(opts.query);

  const scored = [];
  for (let i = 0; i < meta.length; i++) {
    const m = meta[i];
    const v = videos.get(m.videoId);
    if (!v) continue;
    if (sinceMs && (v.watchedAt || v.indexedAt || 0) < sinceMs) continue;
    let score = dot(q, matrix, i * dim);
    if (terms.length) {
      const lower = (m.text + ' ' + (v.title || '')).toLowerCase();
      let hits = 0;
      for (const t of terms) if (lower.includes(t)) hits++;
      score += Math.min(0.1, hits * 0.035);
    }
    if (score >= minScore) scored.push({ i, score });
  }
  scored.sort((a, b) => b.score - a.score);

  const out = [];
  const perVideoCount = new Map();
  const taken = new Map(); // videoId -> starts already shown
  let skipped = 0;
  for (const { i, score } of scored) {
    const m = meta[i];
    const n = perVideoCount.get(m.videoId) || 0;
    if (n >= perVideo) continue;
    // Skip near-duplicate hits from overlapping chunks of the same video.
    const starts = taken.get(m.videoId) || [];
    if (starts.some((s) => Math.abs(s - m.start) < 15)) continue;
    starts.push(m.start);
    taken.set(m.videoId, starts);
    perVideoCount.set(m.videoId, n + 1);
    if (skipped++ < offset) continue;
    const v = videos.get(m.videoId);
    out.push({
      videoId: m.videoId,
      title: v.title,
      channel: v.channel,
      indexedAt: v.indexedAt,
      watchedAt: v.watchedAt,
      titleOnly: v.method === 'history-title',
      speechGenerated: v.method === 'speech-local',
      start: m.start,
      text: m.text,
      score: Math.min(1, score),
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

export function deepLink(videoId, start) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&t=${Math.max(0, Math.floor(start))}s`;
}
