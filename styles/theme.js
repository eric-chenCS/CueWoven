(() => {
  const valid = value => ['light', 'dark'].includes(value) ? value : 'system';
  let current = 'system';
  function apply(value) {
    current = valid(value);
    if (current === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = current;
    const select = document.getElementById('theme');
    if (select) select.value = current;
  }
  const ready = chrome.storage.local.get('theme').then(stored => apply(stored.theme));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.theme) apply(changes.theme.newValue);
  });
  document.addEventListener('DOMContentLoaded', async () => {
    await ready.catch(() => {});
    apply(current);
    document.getElementById('theme')?.addEventListener('change', async event => {
      const previous = current;
      try { await chrome.storage.local.set({theme: valid(event.target.value)}); }
      catch (error) {
        apply(previous);
        const message = document.getElementById('saved');
        if (message) message.textContent = `Could not save theme: ${error.message}`;
      }
    });
  });
})();
