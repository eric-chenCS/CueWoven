// Turn caption segments into overlapping, timestamped chunks for embedding.
// Each chunk keeps the start time of its first caption line, so a search hit
// can deep-link to the moment that chunk begins.

export const DEFAULT_TARGET_WORDS = 40;

const wordCount = (s) => (s.text.match(/\S+/g) || []).length;

/**
 * @param {{start:number, text:string}[]} segments  sorted caption lines
 * @param {{targetWords?:number}} [opts]
 * @returns {{start:number, end:number, text:string}[]}
 */
export function chunkTranscript(segments, opts = {}) {
  const target = opts.targetWords || DEFAULT_TARGET_WORDS;
  const segs = (segments || [])
    .filter((s) => s && typeof s.text === 'string' && s.text.trim())
    .map((s) => ({ start: Number(s.start) || 0, dur: Number(s.dur) || 0, text: s.text.trim(), words: 0 }))
    .sort((a, b) => a.start - b.start);
  for (const s of segs) s.words = wordCount(s);

  const chunks = [];
  let i = 0;
  while (i < segs.length) {
    let words = 0;
    let j = i;
    while (j < segs.length && words < target) {
      words += segs[j].words;
      j++;
    }
    const slice = segs.slice(i, j);
    const last = slice[slice.length - 1];
    chunks.push({
      start: slice[0].start,
      end: last.start + last.dur,
      text: slice.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim(),
    });
    if (j >= segs.length) break;

    // Next window starts about halfway through this one (50% overlap), so a
    // remembered phrase is never split across a chunk boundary only.
    let half = 0;
    let k = i;
    while (k < j - 1 && half < words / 2) {
      half += segs[k].words;
      k++;
    }
    i = Math.max(k, i + 1);
  }
  return chunks;
}
