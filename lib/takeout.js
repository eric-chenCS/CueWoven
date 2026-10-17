import { videoIdFromUrl } from './video.js';

export const MAX_TAKEOUT_BYTES = 100 * 1024 * 1024;
export const cleanWatchTitle = text=>String(text||'').replace(/^(?:Watched|Has visto|Viste|Vous avez regardé|Regardé|Hai guardato|Você assistiu|Assistiu a|Angesehen|Gesehen)\s+/iu,'').replace(/ - YouTube$/u,'').trim().slice(0,300);
export function validateTakeoutFileSize(size) {
  if (!Number.isFinite(size) || size < 0 || size > MAX_TAKEOUT_BYTES) throw new Error('The file exceeds 100 MB. Export only YouTube history from Google Takeout.');
}

export function parseTakeoutHistory(data) {
  if (!Array.isArray(data)) throw new Error('Choose the extracted YouTube watch-history.json file in JSON format.');
  const videos = new Map();
  for (const row of data) {
    if (!row || typeof row.titleUrl !== 'string' || typeof row.title !== 'string' || typeof row.time !== 'string') continue;
    // Only retain video URLs; subscriptions, searches and unavailable videos have no usable video link.
    if (!/^https?:\/\//i.test(row.titleUrl)) continue;
    const videoId = videoIdFromUrl(row.titleUrl);
    const watchedAt = Date.parse(row.time);
    const title = cleanWatchTitle(row.title);
    if (!videoId || !Number.isFinite(watchedAt) || watchedAt <= 0 || !title) continue;
    if (videos.has(videoId) && videos.get(videoId).watchedAt >= watchedAt) continue;
    const channel = Array.isArray(row.subtitles) ? row.subtitles.find(s => typeof s?.name === 'string')?.name || '' : '';
    videos.set(videoId, {videoId, title, channel: channel.slice(0, 200), watchedAt});
  }
  if (!videos.size) throw new Error('No usable YouTube video records were found. Choose YouTube watch-history.json.');
  return Array.from(videos.values()).sort((a, b) => b.watchedAt - a.watchedAt);
}

export function validateHistoryBatch(videos) {
  if (!Array.isArray(videos) || !videos.length || videos.length > 32) throw new Error('Import history in batches of 1–32 videos.');
  return videos.map(v => {
    if (!v || typeof v.videoId !== 'string' || !/^[\w-]{11}$/.test(v.videoId) ||
        typeof v.title !== 'string' || !v.title.trim() ||
        !Number.isFinite(v.watchedAt) || v.watchedAt <= 0) throw new Error('Invalid history video.');
    return {videoId: v.videoId, title: v.title.trim().slice(0, 300), channel: String(v.channel || '').slice(0, 200), watchedAt: v.watchedAt};
  });
}
