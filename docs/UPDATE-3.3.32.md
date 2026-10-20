# CueWoven v3.3.32

**Add videos removed.** CueWoven now saves videos only as you watch them. Pasting YouTube links, **Fetch missing transcripts**, the per-video **Add transcript** button and the Advanced **Pasted links fetched at once** setting are gone, along with the minimized background window and fetch queue behind them. A video saved as a title only, or with AI speech for just the parts you played, tries its captions again the next time you watch it. Existing libraries, title-only entries and old backups are unaffected.

**Smaller surface.** The hidden `recall_index=1` mode that the background window used is removed, so a link carrying it is now an ordinary watch instead of a forced save. Restoring a backup or forgetting recent items no longer waits on a fetch queue. Library & settings has four sections: Library, Websites, Settings and Your data.

Validation: all 265 Node tests pass (the queue and capture-window suites were deleted with their code). In Chromium, the preferences, minimal UI, backup, import integrity, welcome sites, Enter-search, v3.3 features and single-video checks pass. No permissions or storage format changed; the unused `transcriptConcurrency` setting is ignored if present.
