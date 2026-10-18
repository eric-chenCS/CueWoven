export const DEFAULT_SETTINGS = Object.freeze({ enabled: true, dwellSeconds: 20, maxAgeDays: 28, importMaxAgeDays: 0, perVideo: 2, transcriptConcurrency: 6, speechEnabled: true, scenesEnabled: true, articleImagesEnabled:true, screenTextEnabled: true, lightMode: false });

// Retention and website access are managed separately from the Settings section.
export function resetPreferences(current = {}) {
  return {
    settings: { ...current, ...DEFAULT_SETTINGS, maxAgeDays: current.maxAgeDays ?? DEFAULT_SETTINGS.maxAgeDays, importMaxAgeDays: current.importMaxAgeDays ?? DEFAULT_SETTINGS.importMaxAgeDays },
    theme: 'system',
    singleVideoView: true,
  };
}
