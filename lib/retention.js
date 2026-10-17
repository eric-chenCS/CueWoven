export function shouldForgetVideo(video, maxAgeDays, now = Date.now()) {
  const importedTitle=video.method==='history-title'&&(video.historyImported===true||(video.historyImported===undefined&&!video.sceneCount));
  if (!maxAgeDays || importedTitle) return false;
  const lastActivity = Math.max(video.indexedAt || 0, video.watchedAt || 0);
  return lastActivity < now - maxAgeDays * 864e5;
}
