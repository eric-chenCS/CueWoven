// Browser history proves a page was visited, not that its video was watched.
// Keep only video IDs, titles and visit times; do not persist the history scan.
export function historyVideos(items, parseVideoId, limit = 500) {
  const videos = new Map();
  for (const item of items) {
    if (!item || typeof item.url !== 'string') continue;
    const videoId = parseVideoId(item.url);
    const lastVisitTime = Number(item.lastVisitTime);
    if (!videoId || !Number.isFinite(lastVisitTime) || lastVisitTime < 0) continue;
    const existing = videos.get(videoId);
    if (existing && existing.lastVisitTime >= lastVisitTime) continue;
    videos.set(videoId, {
      videoId,
      title: String(item.title || videoId).replace(/ - YouTube$/, '').slice(0, 300),
      lastVisitTime,
    });
  }
  return Array.from(videos.values()).sort((a, b) => b.lastVisitTime - a.lastVisitTime).slice(0, limit);
}
