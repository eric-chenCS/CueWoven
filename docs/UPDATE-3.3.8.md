# Recall 3.3.8

New setups start with YouTube only and saving enabled. The collapsible site list offers Add suggested sites (30) for the rest of the standard news, reference and social list. Click to request optional browser site access before adding them. YouTube uses its existing built-in access. There is no permission request at startup.

Adding individual sites or allowing excluded sites again also requests access, even while saving is paused. Previously granted access may not show a new prompt. Denial leaves the list unchanged. Removing sites continues to exclude future capture/import without deleting saved items.

Existing chosen lists, exclusions, broad-access mode and intentional pauses are preserved. An untouched older automatically populated 31-site list with saving off becomes YouTube-only with saving enabled. Initialization is versioned so removed sites do not reappear later. Existing enabled lists remain selected.

Validation: 235 Node tests pass. Browser validation covers the default list, suggested-site requests, individual-site requests while paused, denied access, exclusion persistence, icons and mixed result labels. No dependency, model or database schema changes.

Reload Recall and refresh Library & settings and existing video/website tabs.
