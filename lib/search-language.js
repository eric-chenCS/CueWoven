// Lexical matching only: embeddings, displayed text and quoted phrases stay intact.
const units = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const values = new Map(units.map((word, n) => [word, n]));
for (const [i, word] of 'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ').entries()) values.set(word, (i + 2) * 10);
const numeric = [...values.keys(), 'hundred', 'thousand'].join('|');
const numberWords = new RegExp(`\\b(?:${numeric})(?:[ -]+(?:and[ -]+)?(?:${numeric}))*\\b`, 'g');
function numbers(text) {
  return text.replace(/(\d)\s*%/g, '$1 percent').replace(numberWords, phrase => {
    let sum = 0, part = 0, previous = '';
    for (const word of phrase.split(/[ -]+/).filter(word => word !== 'and')) {
      // A list like "one two" is not the number three.
      if (values.has(word) && values.has(previous) && !(values.get(previous) >= 20 && values.get(previous) % 10 === 0 && values.get(word) < 10)) return phrase;
      if (word === 'hundred') part = (part || 1) * 100;
      else if (word === 'thousand') {sum += (part || 1) * 1000;part = 0;}
      else part += values.get(word);
      previous = word;
    }
    return String(sum + part);
  });
}
// Bound reusable word forms; repeated caption words should not be stemmed per passage.
const stems = new Map();
export function stem(word) {
  if (!/^[a-z]{4,}$/.test(word)) return word;
  const original=word, cached=stems.get(word);
  if(cached!==undefined)return cached;
  if(word==='news')return word;
  if (/ies$/.test(word) && word.length > 4) word = word.slice(0, -3) + 'y';
  else if (/(?:sses|ches|shes|xes|zes)$/.test(word)) word = word.slice(0, -2);
  else if (/s$/.test(word) && !/(?:ss|us|is)$/.test(word)) word = word.slice(0, -1);
  if (/(?:ing|(?<!e)ed)$/.test(word)) {
    const base = word.replace(/(?:ing|ed)$/, '');
    if (base.length >= 3 && /[aeiouy]/.test(base)) {
      word=base.replace(/([^aeioulsz])\1$/, '$1');
      // Restrict silent-e restoration to common unambiguous endings (hop/hopping keeps its double p).
      if(word===base&&/(?:ar|op|ov|ak|at|iz)$/.test(base))word+='e';
    }
  }
  if (/(?:ation|ition)$/.test(word)) word = word.slice(0, -3);
  if (word.length > 4 && /(?:at|iz|is|ak|ov|os|ic|uc)e$/.test(word)) word = word.slice(0, -1);
  if(stems.size>=4096)stems.clear();
  stems.set(original,word);
  return word;
}
export function wordText(text) {
  const plain = String(text || '').normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC').toLowerCase();
  return (numbers(plain).match(/[\p{L}\p{N}]+/gu) || []).map(stem).join(' ');
}
