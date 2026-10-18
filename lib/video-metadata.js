export function validateVideoMetadataBatch(videos) {
  if (!Array.isArray(videos) || !videos.length || videos.length > 32) throw new Error('Provide 1–32 video metadata records.');
  return videos.map(v => {
    if (!v || typeof v.videoId !== 'string' || !/^[\w-]{11}$/.test(v.videoId) ||
        typeof v.title !== 'string' || !v.title.trim() ||
        !Number.isFinite(v.watchedAt) || v.watchedAt <= 0) throw new Error('Invalid video metadata.');
    return {videoId: v.videoId, title: v.title.trim().slice(0, 300), channel: String(v.channel || '').slice(0, 200), watchedAt: v.watchedAt};
  });
}
