# Recall v3.3.10: popup keyboard shortcut

Press **Ctrl+Shift+F** while Chrome or Edge is focused to open Recall's existing search popup. Clicking the toolbar icon still opens the same popup. The search box already receives focus when the popup opens. Ctrl+F remains the browser's Find on page shortcut. The existing Mac shortcut, Command+Shift+K, is preserved.

The shortcut uses the browser's native `_execute_action` command. No page key listeners or extra permissions are needed.

## Availability and conflicts

Ctrl+Shift+F is not listed as a standard Windows browser shortcut in the official [Chrome](https://support.google.com/chrome/answer/157179) or [Edge](https://support.microsoft.com/en-us/edge/keyboard-shortcuts-in-microsoft-edge) shortcut tables. It is already used for [DevTools resource search](https://developer.chrome.com/docs/devtools/shortcuts) and [Google Sheets compact controls](https://support.google.com/docs/answer/181110). Other extensions, websites or system customizations may also assign it.

If it does not activate after an update, or you prefer a different combination, open `chrome://extensions/shortcuts` or `edge://extensions/shortcuts`, find Recall, and set **Activate the extension** to Ctrl+Shift+F. A browser may retain an existing assignment or leave the command unassigned when another extension owns the combination. Recall does not overwrite manually assigned browser shortcuts. See the [Chrome Commands API](https://developer.chrome.com/docs/extensions/reference/api/commands).

Update the contents of your existing extension folder and reload the extension to preserve your local library. All v3.3.9 short-video fixes are included.
