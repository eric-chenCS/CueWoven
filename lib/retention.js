export function hasImportExemption(video) {
  return !!video && (video.historyImported===true || (video.historyImported===undefined && video.method==='history-title' && !video.sceneCount && !video.screenCount));
}
export function shouldForgetVideo(video, maxAgeDays, now = Date.now(), importMaxAgeDays=0) {
  if(hasImportExemption(video))return [1,7,28,90,365].includes(importMaxAgeDays)&&Number.isFinite(video.watchedAt)&&video.watchedAt>0&&video.watchedAt<now-importMaxAgeDays*864e5;
  if (!maxAgeDays) return false;
  const lastActivity = Math.max(video.indexedAt || 0, video.watchedAt || 0);
  return lastActivity < now - maxAgeDays * 864e5;
}
