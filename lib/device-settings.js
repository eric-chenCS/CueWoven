import {defaultsForMemory} from './settings.js';

// Apply the device default once, so worker restarts never undo the user's switch.
export function createDeviceSettings({storage, memory}) {
  let initializing;
  return () => initializing ||= (async () => {
    let capacity;
    try { capacity = (await memory?.getInfo())?.capacity; } catch {}
    const defaults = defaultsForMemory(capacity);
    const {settings = {}, liteModeInitialized} = await storage.get(['settings', 'liteModeInitialized']);
    if (!liteModeInitialized) {
      await storage.set({
        settings: {...defaults, ...settings, lightMode: settings.lightMode === true || defaults.lightMode},
        // Retry detection on a later worker start if the API was unavailable.
        liteModeInitialized: Number.isFinite(capacity) && capacity > 0,
      });
    }
    return defaults;
  })().catch(error => { initializing = null; throw error; });
}
