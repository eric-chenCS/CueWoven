export function shouldForgetVideo(video, maxAgeDays, now = Date.now()) {
  if (!maxAgeDays || video.method === 'history-title') return false;
  const lastActivity = Math.max(video.indexedAt || 0, video.watchedAt || 0);
  return lastActivity < now - maxAgeDays * 864e5;
}
