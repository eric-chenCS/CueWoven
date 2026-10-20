export const DEFAULT_SETTINGS = Object.freeze({ enabled: true, dwellSeconds: 10, maxAgeDays: 28, importMaxAgeDays: 0, perVideo: 2, speechEnabled: true, scenesEnabled: true, articleImagesEnabled:true, screenTextEnabled: true, lightMode: false, sceneStorageMB: 240 });

// Retention, image storage and website access are managed separately from the Settings section.
export function resetPreferences(current = {}) {
  return {
    settings: { ...current, ...DEFAULT_SETTINGS, maxAgeDays: current.maxAgeDays ?? DEFAULT_SETTINGS.maxAgeDays, importMaxAgeDays: current.importMaxAgeDays ?? DEFAULT_SETTINGS.importMaxAgeDays, sceneStorageMB: current.sceneStorageMB ?? DEFAULT_SETTINGS.sceneStorageMB },
    theme: 'system',
  };
}
