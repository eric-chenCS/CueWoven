// Keep a few short-lived ranked windows; paging never truncates the library.
export function createQueryCache(load, { now = Date.now, ttl = 3e4, entries = 3, windowSize = 256 } = {}) {
  const cache = new Map();
  let revision = 0, additions = 0;
  return {
    invalidate({destructive=true}={}) {
      additions++;
      if(destructive){revision++;cache.clear();}
    },
    async get(key, offset, limit) {
      while (true) {
        let entry = cache.get(key);
        if (!entry || entry.settled && entry.additions !== additions || now() - entry.at >= ttl || offset < entry.from || offset + limit > entry.to) {
          const started = revision, from = offset, to = offset + Math.max(limit, windowSize);
          entry = { at: now(), from, to, revision: started, additions };
          entry.pending = Promise.resolve().then(() => load(key, { offset: from, limit: to - from })).catch((error) => {
            if (cache.get(key) === entry) cache.delete(key);
            throw error;
          });
          cache.delete(key);
          cache.set(key, entry);
          while (cache.size > entries) cache.delete(cache.keys().next().value);
        }
        const result = await entry.pending;
        entry.settled = true;
        if (entry.revision !== revision) continue;
        if (result.sceneError && cache.get(key) === entry) cache.delete(key);
        else if (cache.get(key) === entry) {
          cache.delete(key);
          cache.set(key, entry);
        }
        return { ...result, results: result.results.slice(offset - entry.from, offset - entry.from + limit) };
      }
    }
  };
}
