// Semantic retrieval with bounded passage/phrase evidence. Metadata is context,
// not proof that every moment in a video contains the remembered words.

const STOP = new Set(
  ('the a an and or but of to in on at for with about from by is are was were be been it this that these those ' +
    'video videos where what when who how why guy girl someone talk talks talked talking explain explains explained ' +
    'thing things one said says say some there their they them he she his her you your i me my we our').split(' ')
);

export function queryTerms(query) {
  return Array.from(
    new Set(
      phraseText(query).split(' ').filter(Boolean)
    )
  ).filter(t=>(t.length>=3||/[^\x00-\x7f]/.test(t))&&!STOP.has(t));
}

const normalizeText=text=>String(text||'').normalize('NFD').replace(/\p{M}/gu,'').normalize('NFC').toLowerCase();
const phraseText=text=>(normalizeText(text).match(/[\p{L}\p{N}]+/gu)||[]).join(' ');
const containsPhrase=(text,phrase)=>phrase.length>=3&&(` ${text} `.includes(` ${phrase} `)||(/[\u3040-\u30ff\u3400-\u9fff]/u.test(phrase)&&text.includes(phrase)));
function passageEvidence(query,terms,text,title,channel) {
  const body=phraseText(text),bodyTokens=new Set(body.split(' ')),titleTokens=new Set(phraseText(title).split(' ')),channelTokens=new Set(phraseText(channel).split(' '));
  const hits=terms.filter(term=>bodyTokens.has(term)).length;
  const coverage=terms.length?hits/terms.length:0;
  const phrase=terms.length>=2&&containsPhrase(body,phraseText(query));
  const quoted=[...String(query||'').matchAll(/["“]([^"”]+)["”]/g)].some(match=>queryTerms(match[1]).length>0&&containsPhrase(body,phraseText(match[1])));
  return {hits,coverage,phrase,quoted,context:terms.length?(0.03*terms.filter(term=>titleTokens.has(term)).length+0.01*terms.filter(term=>channelTokens.has(term)).length)/terms.length:0};
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
    const semanticScore=dot(q,matrix,i*dim);
    if(!Number.isFinite(semanticScore))continue;
    const lexical=passageEvidence(opts.query,terms,m.text,v.title,v.channel);
    const direct=lexical.quoted||lexical.phrase||(lexical.hits>=2&&lexical.coverage>=0.8)||(terms.length===1&&lexical.hits===1);
    if(semanticScore<minScore&&!direct)continue;
    const score=semanticScore+0.12*lexical.coverage+(lexical.phrase?0.18:0)+(lexical.quoted?1:0)+lexical.context;
    scored.push({i,score,semanticScore});
  }
  scored.sort((a,b)=>b.score-a.score||b.semanticScore-a.semanticScore||meta[a.i].start-meta[b.i].start||meta[a.i].videoId.localeCompare(meta[b.i].videoId));

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
      titleOnly: m.kind!=='screen-text' && v.method === 'history-title',
      speechGenerated: m.kind!=='screen-text' && v.method === 'speech-local',
      ...(m.kind==='screen-text'?{screenText:true}:{}),
      matchSources: [m.kind==='screen-text'?'On-screen text':v.method==='history-title'?'Title':v.method==='speech-local'?'Audio':'Transcript'],
      start: m.start,
      text: m.text,
      score,
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

// Keep observed timestamps intact for ranking, deduplication and scene evidence.
export function playbackStart(hit){return Math.max(0,hit.start-(hit.screenText?3:0));}
