// How people open CueWoven, read from Chrome so hints match the real setup.
// Chrome skips a suggested shortcut that another extension already uses, and people can change it.
export async function openShortcut() {
  try { return (await chrome.commands.getAll()).find(command => command.name === '_execute_action')?.shortcut || ''; }
  catch { return ''; }
}
// Whether the toolbar icon is pinned; assumes pinned when the browser can't say, so no needless tip shows.
export async function isPinned() {
  try { return (await chrome.action.getUserSettings()).isOnToolbar !== false; }
  catch { return true; }
}
