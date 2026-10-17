# Recall 2.1.0 — transcripts for imported history

Importing a Google Takeout watch-history.json now fetches available YouTube transcripts after saving its titles. The **Fetch transcripts after import** checkbox is on by default; turn it off for a title-only import. Only videos in that file that still lack transcripts are queued, newest watched first. Re-importing does not replace existing transcripts.

Already imported history can be upgraded using **Fetch missing transcripts**. It tries every remaining title-only video, without the manual link box's 50-video cap. Requests run sequentially through the existing muted background-tab capture path. No permission or dependency was added.

Keep Library & settings open. **Pause after current video** stops before opening another video. Closing the page has the same effect after the in-flight request completes. Reopen the page and click Fetch missing transcripts to retry videos still missing transcripts. Failed captions preserve the saved title and original watch date. Successful transcripts preserve that date too. YouTube receives video requests during this process; large histories can take hours.

The progress summary reports successful, failed, already-indexed and unattempted videos. The visible log keeps its latest 100 videos to avoid growing the page indefinitely. Saved library entries are not capped by that display limit.

## Validation

- All 37 existing Node tests pass.
- An isolated browser imported 53 titles with the real embedding model and ran the automatic transcript queue across all 53. Controlled caption outcomes produced one transcript and 52 failures; all titles remained saved. Search found the transcript at 0:42 and its original watch date remained intact.
- Pause completed its one in-flight video and left 51 unattempted. Reloading the settings page recovered the remaining count from saved records. Title-only opt-out did not open YouTube tabs.
- The browser regression fails when the import queue is deliberately capped at 50; the correct implementation was restored afterward.
- The actual background-tab capture pipeline passed with controlled YouTube page/caption responses and real model inference. Existing Takeout deduplication, persistence, backup, date, retention and invalid-file checks passed.
- The user separately confirmed that v2 live capture and exact transcript links work in their normal Edge session. This update uses the same capture implementation. The new automatic import queue was tested with controlled outcomes, not a real account-wide history or guaranteed live availability for every video.

## Install

Update your existing checkout and build the runtime before reloading it. Keeping the checkout path stable preserves the browser extension identity and library. Reload Recall in edge://extensions and reopen Library & settings. The version should read **2.1.0**. Do not keep an old options page open during the update.

For a new installation, extract recall-v2.1.zip and select its manifest-containing folder using Load unpacked. Switching folders creates another extension identity; export/import your library if switching.

The packaged browser regression is tests/browser/import-transcripts.cjs. It needs Playwright, RECALL_PLAYWRIGHT pointing to that module, and RECALL_BROWSER pointing to a Chromium executable that supports loading unpacked extensions. Run it with Node. Its caption outcomes are explicitly controlled; it does not test live YouTube availability.
