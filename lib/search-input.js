// This is a submission guard, not the ranker's broader stop-word list.
const FILLER = new Set(('a an the and or but if so than then of to in on at for from by with about as ' +
  'i me my mine we us our ours you your yours he him his she her hers it its they them their theirs ' +
  'this that these those is am are was were be been being do does did have has had ' +
  'what which who whom whose when where why how there here some any ' +
  "i'm i've i'd i'll you're you've you'd you'll he's she's it's we're we've we'd we'll they're they've they'd they'll " +
  "that's there's don't doesn't didn't isn't aren't wasn't weren't not no").split(' '));

export function hasSearchDetail(query) {
  const text = String(query || '').slice(0, 2000).normalize('NFKC').replace(/’/g, "'");
  // Quotation marks deliberately allow an exact search for a normally filtered word.
  if ([...text.matchAll(/"([^"]+)"|“([^”]+)”/gu)].some(match => /[\p{L}\p{N}]/u.test(match[1] || match[2]))) return true;
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) || [];
  return words.some(word => !FILLER.has(word));
}
