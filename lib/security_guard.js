// lib/security-guard.js
// Verifies that sensitive extension commands only come from trusted extension UI pages.

/**
 * Returns true ONLY if the message came from your own extension's popup, options, or offscreen page
 * (and NOT from a content script running inside an untrusted website tab).
 */
export function isTrustedExtensionPage(sender) {
  if (!sender || sender.id !== chrome.runtime.id) {
    return false;
  }
  // If sender.tab is defined, the message came from a content script inside a web tab
  if (sender.tab) {
    return false;
  }
  return true;
}

/**
 * Prevents Prototype Pollution attacks when importing JSON files from users.
 */
export function safeJsonParse(jsonString) {
  return JSON.parse(jsonString, (key, value) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined;
    }
    return value;
  });
}