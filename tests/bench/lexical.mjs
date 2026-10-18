// Full passages and numeric queries guard the regression that title-only tests missed.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {rank,normalizedPassage} from '../../lib/search.js';
import {lexicalCache,warmLexical} from '../../lib/lexical-cache.js';
const dim=384,matrix=new Float32Array(30000*dim),q=new Float32Array(dim),videos=new Map(),meta=[];
q[0]=1;
const text='Café reef science discusses coral bleaching, ocean temperatures, and the symbiotic algae that provide nutrients. '.repeat(12);
for(let i=0;i<30000;i++){
 const videoId='page'+Math.floor(i/15);
 videos.set(videoId,{videoId,title:'Ocean science '+Math.floor(i/15),channel:'example.com'});
 meta.push(normalizedPassage({videoId,start:i%15*140,text:text+' Observation '+i}));matrix[i*dim]=.2+i%100*.001;
}
lexicalCache.clear();let yields=0;
const start=performance.now();await warmLexical(meta,{yieldTask:async()=>{yields++;await new Promise(resolve=>setTimeout(resolve,0));}});
const preparationMs=performance.now()-start;
assert.ok(yields>0,'cold preparation must yield to document events');
const measurements=[];
for(const query of ['tire rotation every 5000 miles','running ten kilometers interval training','why corals lose color in warm water']){
 const runs=[];
 for(let i=0;i<3;i++){const t=performance.now();rank(q,{matrix,dim,meta},videos,{query,perVideo:1,limit:12});runs.push(performance.now()-t);}
 const median=runs.sort((a,b)=>a-b)[1];measurements.push({query,medianMs:median});
 assert.ok(median<Number(process.env.RECALL_RANK_BUDGET_MS||400),'ranking exceeded the calibrated 400 ms budget: '+query+' '+median);
}
console.log(JSON.stringify({passages:meta.length,preparationMs,yields,measurements,scope:'In-memory ranking after incremental cold preparation; excludes model/DB/UI debounce.'},null,2));
