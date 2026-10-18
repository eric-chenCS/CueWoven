// One owned window keeps capture tabs out of the user's main tab bar.
export function createCaptureWindow(api) {
  const anchorUrl = api.runtime.getURL('capture/capture.html');
  let owned = null, opening = null, stopped = false;
  async function cleanup(record) {
    if (!record) return;
    const [anchor] = await api.runtime.getContexts({contextTypes: ['TAB'], tabIds: [record.anchorTabId], documentUrls: [anchorUrl]});
    // A moved/navigated anchor no longer proves this window belongs to WebLapse.
    if (anchor?.windowId !== record.windowId) return;
    const tabs = await api.tabs.query({windowId: record.windowId});
    for (const tab of tabs) {
      let capture = false;
      try { const u = new URL(tab.url);capture = u.origin === 'https://www.youtube.com' && u.pathname === '/watch' && u.searchParams.get('recall_index') === '1'; } catch { /* user tab */ }
      if (tab.id === record.anchorTabId || capture) await api.tabs.remove(tab.id).catch(() => {});
    }
  }
  return {
    begin() { stopped = false; },
    async get() {
      if (stopped) throw new Error('The capture window was closed. Start fetching again to continue.');
      if (owned) return owned.windowId;
      if (!opening) opening = (async () => {
        const win = await api.windows.create({url: anchorUrl, type: 'normal', state: 'minimized', focused: false});
        const anchor = win.tabs?.[0];
        if (!Number.isInteger(win.id) || !Number.isInteger(anchor?.id)) throw new Error('Could not create the WebLapse capture window.');
        owned = {windowId: win.id, anchorTabId: anchor.id};
        await api.storage.session.set({captureWindow: owned});
        return win.id;
      })().finally(() => {opening = null;});
      return opening;
    },
    async minimize(windowId) {
      if (stopped || owned?.windowId !== windowId) throw new Error('The capture window was closed.');
      // Some Chromium builds restore a window when a new tab is added.
      await api.windows.update(windowId, {state: 'minimized'});
    },
    async close() {
      const record = owned;owned = null;
      await cleanup(record);
      await api.storage.session.remove('captureWindow');
    },
    async recover() {
      const {captureWindow} = await api.storage.session.get('captureWindow');
      await cleanup(captureWindow);
      await api.storage.session.remove('captureWindow');
    },
    removed(windowId) {
      if (owned?.windowId !== windowId) return false;
      owned = null;stopped = true;
      api.storage.session.remove('captureWindow').catch(() => {});
      return true;
    },
  };
}
