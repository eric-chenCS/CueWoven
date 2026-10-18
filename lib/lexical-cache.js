import {wordText} from './search-language.js';
// Main-index rows die with their snapshot. Website rows are re-read, so reuse a small text cache.
export function createLexicalCache({rowBudget=16*1024*1024,textBudget=2*1024*1024}={}) {
  let rows=new WeakMap(),rowBytes=0,textBytes=0,generation=0;
  const texts=new Map();
  const compact=text=>[...new Set(wordText(text).split(' '))].join(' ');
  return {
    get generation(){return generation;},
    words(row) {
      if(typeof row==='string')return compact(row);
      const text=String(row.text||''),cached=rows.get(row);
      if(cached?.text===text)return cached.words;
      let words=texts.get(text)?.words;
      if(words===undefined)words=compact(text);
      const size=words.length*2+64;
      if(size<=rowBudget){
        if(rowBytes+size>rowBudget){rows=new WeakMap();rowBytes=0;}
        rows.set(row,{text,words});rowBytes+=size;
      }
      // Do not retain long captions through text keys after their parent index disappears.
      if(text.length<=400&&!texts.has(text)){
        const bytes=(text.length+words.length)*2+64;
        while(textBytes+bytes>textBudget&&texts.size){const key=texts.keys().next().value;textBytes-=texts.get(key).bytes;texts.delete(key);}
        if(bytes<=textBudget){texts.set(text,{words,bytes});textBytes+=bytes;}
      }
      return words;
    },
    clear(){generation++;rows=new WeakMap();rowBytes=0;texts.clear();textBytes=0;},
  };
}
export const lexicalCache=createLexicalCache();
// Yield while preparing a large snapshot so document events can still run during cold loading.
export async function warmLexical(rows,{cache=lexicalCache,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
  let until=performance.now()+8;
  const generation=cache.generation;
  for(const row of rows){if(cache.generation!==generation)return;cache.words(row);if(performance.now()>=until){await yieldTask();until=performance.now()+8;}}
}
