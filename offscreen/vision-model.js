// Serialize scene inference and release its worker after inactivity.
export function createVisionModel(onState = () => {}) {
  let worker = null, nextId = 0, timer, deadline, running = false, queuedText = null, warming = null;
  const pending = new Map();
  function release() {
    clearTimeout(timer);clearTimeout(deadline);worker?.terminate();worker = null;
    for (const request of pending.values()) request.reject(new Error('Scene processing stopped.'));
    pending.clear();onState({status: 'idle'});
    queuedText?.reject(new Error('Scene processing stopped.'));queuedText = null;
  }
  async function call(type, payload) {
    if (running) throw new Error('Scene model is busy. Try again in a moment.');
    running = true;clearTimeout(timer);let percent = -1;
    try {
      onState({status: 'working', operation: type});
      if (!worker) {
        worker = new Worker(new URL('vision-worker.js', import.meta.url), {type: 'module'});
        worker.onmessage = ({data}) => {
          const request = pending.get(data.id);if (!request) return;
          if ('progress' in data) {request.progress(data.progress);return;}
          pending.delete(data.id);data.error ? request.reject(new Error(data.error)) : request.resolve(data.result);
        };
        worker.onerror = () => release();
      }
      const result = await new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, {resolve, reject, progress: progress => {const current = Math.round(progress * 100);if (current !== percent) {percent = current;onState({status: 'loading', operation: type, progress});}}});
        deadline=setTimeout(()=>{release();},180000);
        worker.postMessage({id, type, ...payload});
      });
      onState({status:'ready'});return result;
    } catch (error) {onState({status: 'error', error: error.message});throw error;}
    finally {
      clearTimeout(deadline);running = false;
      const next = queuedText;queuedText = null;
      if (next) call('text',{query:next.query}).then(next.resolve,next.reject);
      else timer = setTimeout(release,60000);
    }
  }
  function text(query) {
    if (!running) return call('text',{query});
    queuedText?.reject(new Error('A newer scene search replaced this query.'));
    return new Promise((resolve,reject)=>{queuedText={query,resolve,reject}});
  }
  function warmup() {
    if(warming)return warming;
    if(queuedText)return Promise.resolve(); // A real pending query already warms text inference.
    warming=text('a video scene').finally(()=>{warming=null});return warming;
  }
  return {image: async image => {if(warming)await warming.catch(()=>{});return call('image',{image});}, text, warmup, release};
}
