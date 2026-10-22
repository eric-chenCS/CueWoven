export const DEFAULT_SETTINGS = Object.freeze({ enabled: true, dwellSeconds: 10, maxAgeDays: 28, importMaxAgeDays: 0, perVideo: 2, speechEnabled: true, scenesEnabled: false, articleImagesEnabled:false, screenTextEnabled: true, lightMode: false, sceneStorageMB: 240 });

export function defaultsForMemory(capacity) {
  return { ...DEFAULT_SETTINGS, lightMode: Number.isFinite(capacity) && capacity > 0 && capacity <= 8 * 1024 ** 3 };
}

// Retention, image storage and website access are managed separately from the Settings section.
export function resetPreferences(current = {}, defaults = DEFAULT_SETTINGS) {
  return {
    settings: { ...current, ...defaults, maxAgeDays: current.maxAgeDays ?? defaults.maxAgeDays, importMaxAgeDays: current.importMaxAgeDays ?? defaults.importMaxAgeDays, sceneStorageMB: current.sceneStorageMB ?? defaults.sceneStorageMB },
    theme: 'system',
  };
}
