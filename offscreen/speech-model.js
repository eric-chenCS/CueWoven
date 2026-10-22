export function createSpeechModel() {
  let worker = null, nextId = 0;
  const pending = new Map();
  function release() {
    worker?.terminate();worker = null;
    for (const request of pending.values()) request.reject(new Error('Speech model stopped.'));
    pending.clear();
  }
  function call(type, pcm, progress) {
    if (!worker) {
      worker = new Worker(new URL('speech-worker.js', import.meta.url), {type: 'module'});
      const current=worker;
      worker.onmessage = ({data}) => {
        if(worker!==current)return;
        const request = pending.get(data.id);if (!request) return;
        if ('progress' in data) {request.progress?.(data.progress);return;}
        pending.delete(data.id);data.error ? request.reject(new Error(data.error)) : request.resolve(data.result);
      };
      worker.onerror = () => {if(worker===current)release();};
      worker.addEventListener('messageerror',worker.onerror);
    }
    return new Promise((resolve, reject) => {
      const id = ++nextId;pending.set(id, {resolve, reject, progress});
      worker.postMessage({id, type, pcm}, pcm ? [pcm.buffer] : []);
    });
  }
  return {prepare: progress => call('prepare', undefined, progress), transcribe: pcm => call('transcribe', pcm), release};
}
