// Semantic retrieval with bounded passage/phrase evidence. Metadata is context,
// not proof that every moment in a video contains the remembered words.
import {wordText,numberText,stem} from './search-language.js';

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
  ).filter(t=>(t.length>=3||/[^\x00-\x7f]/.test(t)||/^\d+$/.test(t))&&!STOP.has(t));
}

const normalizeText=text=>String(text||'').normalize('NFD').replace(/\p{M}/gu,'').normalize('NFC').toLowerCase();
export const phraseText=text=>(normalizeText(text).match(/[\p{L}\p{N}]+/gu)||[]).join(' ');
const containsPhrase=(text,phrase)=>phrase.length>=3&&(` ${text} `.includes(` ${phrase} `)||(/[\u3040-\u30ff\u3400-\u9fff]/u.test(phrase)&&text.includes(phrase)));
export const normalizedPassage = row => ({...row, lexicalText: phraseText(row.text)});
// Ranking weights, kept in one place so YouTube passages and website items score alike.
export const WEIGHTS = Object.freeze({coverage:0.18, phrase:0.18, quoted:1, title:0.22, channel:0.02, channelName:0.12, support:0.15, supportFloor:0.25});

// How distinctive each query word is in this library: words found in few passages
// separate similar videos; words found everywhere ("battery" in a battery library) barely count.
const idf = (total, df) => Math.log(1 + (total + 1) / (df + 1));
export function termWeights(terms, passages) {
  const df = new Array(terms.length).fill(0), normalized=terms.map(wordText), prepared={terms:normalized,numeric:normalized.some(term=>/^\d+$/.test(term)||term==='percent')};let total = 0;
  for (const text of passages) {total++;const mask = lexicalMask(prepared,text);for (let j = 0; j < terms.length; j++) if (mask & (1 << j)) df[j]++;}
  return new Map(terms.map((term, j) => [term, idf(total, df[j])]));
}
// Bit j is set when query word j appears as a whole word. Up to 30 words are tracked.
export const MAX_TERMS = 30;
export function termMask(terms, body) {
  const padded = ' ' + body + ' ';let mask = 0;
  for (let j = 0; j < terms.length && j < MAX_TERMS; j++) if (padded.includes(' ' + terms[j] + ' ')) mask |= 1 << j;
  return mask;
}
const weightOf = (prepared, term) => prepared.weights?.get(term) ?? 1;
const weightSum = (prepared, terms) => terms.reduce((sum, term) => sum + weightOf(prepared, term), 0);

function lexicalMask(prepared, text, literal=phraseText(text)) {
  const body=prepared.numeric?numberText(text):literal;
  let mask=termMask(prepared.terms,body);
  for(let j=0;j<prepared.terms.length;j++) {
    if(mask&(1<<j))continue;
    const term=prepared.terms[j];
    if(!/^[a-z]{3,}$/.test(term))continue;
    prepared.patterns??=new Map();
    let pattern=prepared.patterns.get(term);
    if(!pattern){const prefix=term.endsWith('y')?term.slice(0,-1)+'(?:y|i)':term;pattern=new RegExp('(?<![\\p{L}\\p{N}])'+prefix+'[a-z]*(?![\\p{L}\\p{N}])','gu');prepared.patterns.set(term,pattern);}
    pattern.lastIndex=0;
    for(const match of body.matchAll(pattern))if(stem(match[0])===term){mask|=1<<j;break;}
  }
  return mask;
}
const lexicalStops = new Set([...STOP].filter(term=>term!=='one').map(wordText));
export function prepareQuery(query, terms, weights) {
  terms = [...new Set(wordText(terms ? terms.join(' ') : query).split(' ').filter(term => term && !lexicalStops.has(term) && (term.length>=3 || /^\d+$/.test(term) || /[^\x00-\x7f]/.test(term))))].slice(0, MAX_TERMS);
  return {query,terms,weights,numeric:terms.some(term=>/^\d+$/.test(term)||term==='percent'),phrase:phraseText(query),quotes:[...String(query||'').matchAll(/["“]([^"”]+)["”]/g)].filter(match=>queryTerms(match[1]).length).map(match=>phraseText(match[1])),contexts:new Map()};
}
// Naming the channel ("the Motor Explained video") is deliberate, so it counts as strong evidence.
// Multi-word names count anywhere; a one-word name ("Battery") must be used as a source ("Battery video", "by Battery").
function namesChannel(prepared, channel) {
  prepared.named ??= new Map();
  if (!prepared.named.has(channel)) {
    const name = phraseText(channel);
    prepared.named.set(channel, name.length >= 3 && (name.includes(' ') ? containsPhrase(prepared.phrase, name) : [`${name} video`, `${name} videos`, `${name} channel`, `by ${name}`, `from ${name}`].some(form => containsPhrase(prepared.phrase, form))));
  }
  return prepared.named.get(channel);
}
// Title and channel evidence is per video, so it is computed once per search and cached.
function videoContext(prepared, title, channel) {
  const key=JSON.stringify([title,channel]);
  let context=prepared.contexts.get(key);
  if(context===undefined){
    const terms=prepared.terms,titleTokens=new Set(wordText(title).split(' ')),channelTokens=new Set(wordText(channel).split(' ')),total=weightSum(prepared,terms);
    const titleShare=total?weightSum(prepared,terms.filter(term=>titleTokens.has(term)))/total:0,channelShare=total?weightSum(prepared,terms.filter(term=>channelTokens.has(term)))/total:0;
    const named=namesChannel(prepared,channel);
    // The more of the query the name makes up ("the Retire Smart video"), the more it counts.
    context={score:WEIGHTS.title*titleShare+WEIGHTS.channel*channelShare+(named?WEIGHTS.channelName*(1+channelShare):0),named};
    prepared.contexts.set(key,context);
  }
  return context;
}
export function passageEvidence(query,terms,text,title,channel,prepared=prepareQuery(query,terms),mask) {
  const body=text&&typeof text==='object' ? text.lexicalText ?? phraseText(text.text) : phraseText(text);
  terms=prepared.terms;
  if(mask===undefined)mask=lexicalMask(prepared,text?.text??(typeof text==='string'?text:body),body);
  const matched=terms.filter((_,j)=>mask&(1<<j)),hits=matched.length,total=weightSum(prepared,terms);
  const coverage=total?weightSum(prepared,matched)/total:0;
  const phrase=terms.length>=2&&containsPhrase(body,prepared.phrase);
  const quoted=prepared.quotes.some(quote=>containsPhrase(body,quote));
  const context=videoContext(prepared,title,channel);
  return {hits,coverage,phrase,quoted,context:context.score,named:context.named};
}
export function scoredEvidence(prepared,row,video,semanticScore,minScore,mask) {
  const body=row.lexicalText ?? phraseText(row.text);
  // Typing a channel's full name ("the Retire Smart video") points at that channel's videos even
  // when the rest of the query says little about their content.
  const named=namesChannel(prepared,video.channel);
  mask ??= lexicalMask(prepared,row.text,body);
  if(semanticScore<minScore&&!named&&!prepared.quotes.some(quote=>containsPhrase(body,quote))&&!mask)return null;
  const lexical=passageEvidence(prepared.query,prepared.terms,{lexicalText:body},video.title,video.channel,prepared,mask);
  const direct=lexical.quoted||lexical.phrase||named||(lexical.hits>=2&&lexical.coverage>=0.8)||(prepared.terms.length===1&&lexical.hits===1);
  return semanticScore<minScore&&!direct?null:lexical;
}

// One score for every passage source: meaning first, then distinctive words, exact phrases and metadata.
export const evidenceScore = (semanticScore, lexical) => semanticScore + WEIGHTS.coverage * lexical.coverage + (lexical.phrase ? WEIGHTS.phrase : 0) + (lexical.quoted ? WEIGHTS.quoted : 0) + lexical.context;
// Like Microsoft Recall: a close match contains your distinctive words; a related one shares the meaning.
export const matchStrength = lexical => lexical.quoted || lexical.phrase || lexical.coverage >= 0.5 ? 'close' : 'related';

export function dot(a, b, offsetB = 0) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[offsetB + i];
  return s;
}

// Ranking runs in two steps so every source is scored on one scale:
//   1. collect: each source (YouTube index, website items, older batches) adds its passages to a
//      shared pool, which records meaning scores, matched words and how often each word occurs;
//   2. rankPool: word weights come from the whole pool, then passages are scored, supported and sorted.
export function createPool(prepared, {minScore = 0.15} = {}) {
  return {prepared, minScore, df: new Array(prepared.terms.length).fill(0), total: 0, candidates: []};
}

// Add one passage. `video` may be null/filtered: the passage still counts toward word frequencies.
// `toHit(score, match)` builds the result object for this source; `window` is the de-duplication gap.
export function addPassage(pool, row, video, semanticScore, toHit, window = 15) {
  const {prepared} = pool, terms = prepared.terms;
  const body = row.lexicalText ?? phraseText(row.text);
  const mask = terms.length ? lexicalMask(prepared,row.text,body) : 0;
  pool.total++;
  if (mask) for (let j = 0; j < terms.length; j++) if (mask & (1 << j)) pool.df[j]++;
  if (!video || !Number.isFinite(semanticScore)) return;
  // Cheap gate before any scoring: relevant by meaning, by a word, or by a named channel.
  if (semanticScore < pool.minScore && !mask && !namesChannel(prepared, video.channel)) return;
  pool.candidates.push({row:row.videoId?row:{...row,videoId:video.videoId}, body, video, semanticScore, mask, toHit, window});
}

const youtubeHit = (m, v) => (score, match) => ({
  videoId: m.videoId,
  ...(v.kind?{kind:v.kind,url:v.url,itemId:m.videoId,mediaKey:v.mediaKey}:{}),
  ...(v.sample?{sample:true}:{}),
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
  match,
});

/** Add every passage of a packed YouTube/screen-text index to the pool. */
export function addIndex(pool, q, index, videos, {sinceMs = 0} = {}) {
  const {matrix, dim, meta} = index;
  for (let i = 0; i < meta.length; i++) {
    const m = meta[i], v = videos.get(m.videoId);
    m.lexicalText ??= phraseText(m.text);
    const eligible = v && !(sinceMs && (v.watchedAt || v.indexedAt || 0) < sinceMs);
    addPassage(pool, m, eligible ? v : null, eligible ? dot(q, matrix, i * dim) * (index.scales?.[i] ?? 1) : NaN, eligible ? youtubeHit(m, v) : null);
  }
}

/** Score, support and sort everything in the pool. Returns at most `perVideo` moments per video. */
export function rankPool(pool, {limit = Infinity, perVideo = 2, offset = 0} = {}) {
  const {prepared} = pool;
  if (!prepared.weights) {
    prepared.weights = new Map(prepared.terms.map((term, j) => [term, idf(pool.total, pool.df[j])]));
    prepared.contexts.clear(); // title/channel evidence must use the final weights
  }
  const scored = [];
  for (const c of pool.candidates) {
    const lexical = scoredEvidence(prepared, c.row, c.video, c.semanticScore, pool.minScore, c.mask);
    if (lexical) scored.push({...c, score: evidenceScore(c.semanticScore, lexical), match: matchStrength(lexical)});
  }
  const support = videoSupport(scored);
  for (const hit of scored) hit.score += support.get(hit.row.videoId) || 0;
  scored.sort((a, b) => b.score - a.score || b.semanticScore - a.semanticScore || a.row.start - b.row.start || a.row.videoId.localeCompare(b.row.videoId));
  const out = [], perVideoCount = new Map(), taken = new Map();
  let skipped = 0;
  for (const hit of scored) {
    const id = hit.row.videoId, n = perVideoCount.get(id) || 0;
    if (n >= perVideo) continue;
    // Skip near-duplicate hits from overlapping chunks of the same video.
    const starts = taken.get(id) || [];
    if (hit.window && starts.some(s => Math.abs(s - hit.row.start) < hit.window)) continue;
    starts.push(hit.row.start);taken.set(id, starts);perVideoCount.set(id, n + 1);
    if (skipped++ < offset) continue;
    out.push(hit.toHit(hit.score, hit.match));
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * @param {Float32Array} q             normalized query vector (dim D)
 * @param {{matrix:Float32Array, dim:number, meta:{videoId:string,start:number,text:string}[]}} index
 * @param {Map<string, object>} videos videoId -> video record
 * @param {{query?:string, prepared?:object, limit?:number, perVideo?:number, sinceMs?:number, minScore?:number, offset?:number}} opts
 */
export function rank(q, index, videos, opts = {}) {
  const pool = createPool(opts.prepared ?? prepareQuery(opts.query), {minScore: opts.minScore ?? 0.15});
  addIndex(pool, q, index, videos, {sinceMs: opts.sinceMs ?? 0});
  const offset = Number.isSafeInteger(opts.offset) && opts.offset >= 0 ? opts.offset : 0;
  return rankPool(pool, {limit: opts.limit ?? 12, perVideo: opts.perVideo ?? 2, offset});
}

// Whole-video support: a second, separate moment that also matches lifts the video a little.
// Moments are taken strongest first, so the result never depends on the order passages arrive in.
export function videoSupport(scored) {
  const byVideo = new Map();
  for (const hit of scored) {const list = byVideo.get(hit.row.videoId) || [];list.push(hit);byVideo.set(hit.row.videoId, list);}
  const support = new Map();
  for (const [videoId, hits] of byVideo) {
    hits.sort((a, b) => b.semanticScore - a.semanticScore || a.row.start - b.row.start);
    const kept = [];
    for (const hit of hits) {if (!kept.some(other => Math.abs(other.row.start - hit.row.start) < 15)) kept.push(hit);if (kept.length === 2) break;}
    support.set(videoId, kept[1] ? WEIGHTS.support * Math.max(0, kept[1].semanticScore - WEIGHTS.supportFloor) : 0);
  }
  return support;
}

// Near tie: two different videos whose transcript/page scores are almost equal. Scene evidence comes
// from another model and fusion reorders by rank, so any scene-backed result disqualifies the comparison.
export const NEAR_TIE = 0.04;
export function nearTie(results) {
  const [first] = results, rival = results.find(hit => hit.videoId !== first?.videoId);
  if (!first || !rival || !Number.isFinite(first.score) || !Number.isFinite(rival.score)) return false;
  const textOnly = hit => !hit.scene && !(hit.matchSources || []).includes('Scene');
  return textOnly(first) && textOnly(rival) && first.score >= rival.score && first.score - rival.score < NEAR_TIE;
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
