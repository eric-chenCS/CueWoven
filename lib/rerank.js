import {nearTie} from './search.js';
import {hasRelevantText} from './scenes.js';

export const rerankQuery = query => typeof query === 'string' && !!query.trim() && query.length <= 2000 && !/["“”]/.test(query);

// Keep the studied shortlist/input contract: 20 owners, two passages, ten model pairs.
export function rerankCandidates(query, hits) {
  if (!rerankQuery(query)) return null;
  const passages = hits.slice(0, 40), owners = new Map();
  for (const hit of passages) if (!owners.has(hit.videoId) && owners.size < 20) owners.set(hit.videoId, hit);
  const candidates = [...owners.values()];
  if (!nearTie(candidates) || hasRelevantText(candidates)) return null;
  return candidates.slice(0, 10).map(hit => ({
    videoId: hit.videoId,
    text: [hit.title, hit.channel, ...passages.filter(p => p.videoId === hit.videoId).slice(0, 2).map(p => p.text)].filter(Boolean).join('\n').slice(0, 8192),
  }));
}

export function applyRerank(hits, candidates, scores) {
  if (!Array.isArray(scores) || scores.length !== candidates.length || !scores.every(Number.isFinite)) return hits;
  const order = scores.map((score, i) => ({score, i})).sort((a, b) => b.score - a.score || a.i - b.i);
  if (order.length < 2 || order[0].score - order[1].score < 1 || order.every((entry, i) => entry.i === i)) return hits;
  const positions = new Map(order.map(({i}, rank) => [candidates[i].videoId, rank]));
  // Only the first 40 positions move: deeper cached pages keep their original boundaries.
  const prefix = hits.slice(0, 40).map((hit, i) => ({hit, i}));
  prefix.sort((a, b) => (positions.get(a.hit.videoId) ?? 10) - (positions.get(b.hit.videoId) ?? 10) || a.i - b.i);
  return [...prefix.map(({hit}) => hit), ...hits.slice(40)];
}
