# CueWoven v3.3.22

The extension is now CueWoven. Browser labels, UI, setup documentation, sample labels, ZIPs and new backup filenames use the new name. The original installed folder, IndexedDB database, saved titles, settings, internal protocols, rc shortcut and backup format remain compatible.

Search now waits for Enter. Typing a main query or refinement clears stale matches and shows a Press Enter prompt without sending a search request. Filters cannot submit an unfinished query. The first Enter displays matches; another Enter can open the shown match. Pending responses are rejected when text changes. Reopening restores the last submitted query without automatically searching; sample loading also waits for Enter. Filters and ranked navigation remain available after submission.

Validation: all 290 Node tests pass. Isolated Chromium checks cover Enter-only draft submission, refinement with the real model, 14 ranked results and keyboard opening, plus renamed labels, legacy backups, original database identity and saved content preservation.
