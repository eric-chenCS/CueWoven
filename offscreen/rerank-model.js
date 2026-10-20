import {rerankCandidates, applyRerank} from '../lib/rerank.js';

// Optional second opinion: never queue searches behind downloads or old inference.
export function createReranker({WorkerClass = globalThis.Worker, timeoutMs = 1800, loadTimeoutMs = 120000, idleMs = 60000, cooldownMs = 60000, now = Date.now} = {}) {
  let worker = null, ready = false, warming = null, finishWarmup, active = null, nextId = 0, timer, deadline, retryAt = 0;
  function release({failed = false} = {}) {
    clearTimeout(timer); clearTimeout(deadline);
    worker?.terminate(); worker = null; ready = false;
    active?.resolve(null); active = null;
    finishWarmup?.(false); finishWarmup = null; warming = null;
    if (failed) retryAt = now() + cooldownMs;
  }
  function idle() {clearTimeout(timer); timer = setTimeout(release, idleMs);}
  function warmup() {
    if (ready) return Promise.resolve(true);
    if (warming) return warming;
    if (now() < retryAt) return Promise.resolve(false);
    warming = new Promise(resolve => {finishWarmup = resolve;});
    const result = warming;
    try {
      const created = worker = new WorkerClass(new URL('rerank-worker.js', import.meta.url), {type: 'module'});
      created.onmessage = ({data}) => {
        if (worker !== created) return;
        if (data.error) {release({failed: true}); return;}
        if (data.id === 0 && data.ready === true) {
          clearTimeout(deadline); ready = true;
          finishWarmup?.(true); finishWarmup = null; warming = null; idle(); return;
        }
        if (!active || data.id !== active.id) return;
        clearTimeout(deadline);
        const request = active; active = null; idle();
        request.resolve(data.scores);
      };
      created.onerror = () => {if (worker === created) release({failed: true});};
      deadline = setTimeout(() => release({failed: true}), loadTimeoutMs);
      created.postMessage({id: 0, type: 'init'});
    } catch {release({failed: true});}
    return result;
  }
  async function rerank(query, hits, evidence = hits) {
    const candidates = rerankCandidates(query, evidence);
    if (!candidates || now() < retryAt) return {hits};
    if (!ready) {void warmup(); return {hits, pending: !!warming};}
    if (active) return {hits};
    clearTimeout(timer);
    const scores = await new Promise(resolve => {
      const id = ++nextId; active = {id, resolve};
      deadline = setTimeout(() => release({failed: true}), timeoutMs);
      try {worker.postMessage({id, type: 'score', query, documents: candidates.map(candidate => candidate.text)});}
      catch {release({failed: true});}
    });
    if (!scores) return {hits};
    const ranked = applyRerank(hits, candidates, scores);
    return {hits: ranked, applied: ranked !== hits};
  }
  return {rerank, warmup, release, cancel: () => {if (active) release();}, status: () => ({status: active ? 'working' : ready ? 'ready' : warming ? 'loading' : now() < retryAt ? 'cooldown' : 'idle'})};
}
