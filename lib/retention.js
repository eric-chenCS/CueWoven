export function hasImportExemption(video) {
  return !!video && (video.historyImported===true || (video.historyImported===undefined && video.method==='history-title' && !video.sceneCount && !video.screenCount));
}
export function shouldForgetVideo(video, maxAgeDays, now = Date.now()) {
  if (!maxAgeDays || hasImportExemption(video)) return false;
  const lastActivity = Math.max(video.indexedAt || 0, video.watchedAt || 0);
  return lastActivity < now - maxAgeDays * 864e5;
}
