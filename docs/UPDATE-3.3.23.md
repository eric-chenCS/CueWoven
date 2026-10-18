# CueWoven v3.3.23

Takeout imports and browser-history scans are removed, including the history permission, public scan/import routes, parsers and obsolete tests. Add videos remains for deliberately pasted YouTube links. Live page/video capture and local Google-query capture keep their existing permission and opt-in rules.

Your data keeps one Export backup action and one Restore backup file picker. Nearby guidance explains profile/uninstall data loss, local-only storage, exactly which saved evidence is included, and that backups do not include full source videos, audio recordings, settings, permissions or models. A backup cannot recover an original source that was deleted online.

Existing saved entries are not deleted. Legacy backups still restore titles, captions, page text, OCR and captured images. Stored imported-item retention preferences remain honored for old records even though their old settings control is removed. Settings changes preserve those hidden legacy preferences. Internal title metadata support remains necessary for live capture and legacy backups.

The history permission was previously optional (requested at runtime), not an install-time permission. Removing it eliminates that optional request; other site permissions still apply.

Validation: all 277 Node tests pass. Isolated Chromium checks cover backup export/download/restore, legacy title and caption/OCR compatibility, Takeout rejection without data loss, hidden retention preservation, Enter-only search, responsive UI/preferences, live article capture with text-fragment retrieval, and the retained manual caption queue (three simultaneous controlled players, settings closed, pause/cleanup and a 0:42 search match). Restoring the removed history permission in a disposable copy fails the new regression. Runtime dependencies are unchanged; the audit still reports three high Node-only sharp findings and one moderate sprintf-js finding outside the browser runtime.
