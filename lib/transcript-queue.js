// Owns a bounded job independently of any popup or settings page.
export function createTranscriptQueue({processVideo, beforeStart = async () => {}, onChange = () => {}, initial = null}) {
  let state = initial ? {...initial, status: ['running', 'pausing'].includes(initial.status) ? 'interrupted' : initial.status, active: []} : null;
  let task = Promise.resolve();
  const snapshot = () => state ? structuredClone(state) : null;
  function publish() {
    state.revision++;
    try { Promise.resolve(onChange(snapshot())).catch(e => console.warn('Could not save transcript progress:', e.message)); }
    catch (e) { console.warn('Could not save transcript progress:', e.message); }
  }
  async function work(ids) {
    let cursor = 0;
    try {
      await beforeStart();
      await Promise.all(Array.from({length: 3}, async () => {
        while (state.status === 'running' && cursor < ids.length) {
          const videoId = ids[cursor++];
          const active = {videoId};
          state.active.push(active);
          publish();
          let result;
          try {
            result = await processVideo(videoId, tabId => { active.tabId = tabId; publish(); });
            if (!result || !['done', 'skipped', 'failed'].includes(result.status)) throw new Error('No transcript result returned.');
          } catch (e) { result = {videoId, status: 'failed', reason: String(e.message || e).slice(0, 500)}; }
          state.active = state.active.filter(item => item !== active);
          state.completed++;
          state[result.status]++;
          state.results.push({...result, videoId});
          state.results = state.results.slice(-100);
          publish();
        }
      }));
      state.status = state.completed === state.total ? 'done' : 'paused';
    } catch (e) {
      state.status = 'interrupted';
      state.reason = String(e.message || e).slice(0, 500);
    }
    publish();
  }
  return {
    get: snapshot,
    start(ids) {
      if (state && ['running', 'pausing'].includes(state.status)) throw new Error('Transcript fetching is already running.');
      const unique = Array.from(new Set(ids));
      if (!unique.length || unique.some(id => typeof id !== 'string' || !/^[\w-]{11}$/.test(id))) throw new Error('No valid video IDs to fetch.');
      state = {id: crypto.randomUUID(), revision: 0, status: 'running', total: unique.length, completed: 0, done: 0, skipped: 0, failed: 0, active: [], results: []};
      publish();
      task = work(unique);
      return snapshot();
    },
    pause() {
      if (state?.status === 'running') { state.status = 'pausing'; publish(); }
      return snapshot();
    },
    wait: () => task,
  };
}
