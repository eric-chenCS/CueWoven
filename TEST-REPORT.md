# Recall test report

## Version 2.4.0 update

Browser-history Add all now attempts transcripts by default. Transcript work moved into a background queue with up to three concurrent muted inactive tabs and one model warmup. Settings can be closed after the job starts. All 49 Node tests, both 53-video import browser tests (production queue with controlled caption outcomes), and the real service-worker background browser test passed. Six videos finished with every settings page closed; progress, original dates, search at 0:42, pause and tab cleanup were verified. Destructive data operations are blocked during an active job. Polling uses wall-clock deadlines to avoid repeated throttled timer cycles. See UPDATE-2.4.md for browser/worker interruption behavior and limits. No live account-wide speedup was measured; temporary YouTube tabs are still required.

## Version 2.3.0 update

One video at a time is now the default popup view. All 40 Node tests pass, including 25-video pagination, best-timestamp selection, uniqueness, date/score eligibility and validated background routing. A deliberate ignored-offset regression was caught and restored. The new single-video browser regression uses the real model/ranker with 13 controlled transcripts and one imported title: all 14 distinct videos can be browsed, including beyond result 12. It checks correct timestamp/title-only links, next/previous boundaries, query/refinement/date resets, delayed-page rejection, list opt-out persistence and empty-query navigation. Light/dark screenshots were inspected. The existing refinement browser regression also passes. Live YouTube capture was not changed or retested for this search-view update.

## Version 2.2.0 update

Added optional Refine beside the popup search box. All 37 Node tests pass. The new tests/browser/refine-search.cjs browser test verifies independent default searches, combined and editable clues, keyboard focus and submission, date filters, clearing, closing refinement, popup reopen and delayed-response rejection. Controlled responses isolate UI races; a second phase uses the real local MiniLM model and ranker with two saved transcript fixtures. The refined Minecraft query opened 1:12, then an independent battery query opened 0:42. Light/dark popup screenshots were inspected and horizontal overflow was checked. YouTube capture itself was not changed or retested for this UI update.

## Version 2.1.0 update

The user confirmed that v2 captures live transcripts and opens exact transcript moments in their normal Edge session. Version 2.1 adds automatic transcript attempts after a Takeout import and a resumable missing-transcript queue. All 37 Node tests, the 53-video import/queue browser regression, existing Takeout checks, and the actual background-tab capture pipeline with controlled YouTube responses passed. A deliberate 50-video-cap regression was detected by the new browser test and restored. See UPDATE-2.1.md for scope, reproduction and limitations. New automatic queue outcomes were controlled, not an account-wide live import.

## Historical v2.0.0 isolated-browser report

Tested October 17, 2026 on Windows with Chrome for Testing 151 and isolated profiles. The user's regular Edge history, cookies and library were not read.

## Verdict

**Fixes 2–6 are implemented and verified. Live transcript capture remains unresolved.** Title import/search and controlled transcript search work. The new player-response capture and caption-activation paths pass controlled tests but did not overcome YouTube's empty caption responses or transcript API rejection in the live tests.

## Unit checks

37 tests passed. Coverage includes caption parsers, chunking/ranking, video URL validation, optional history authorization, Takeout parsing, file-size validation, original-watch-date filtering, transcript retention, and the bridge's live-versus-bulk watch-date behavior. Transcript-panel parsing covers both legacy and newer view-model layouts, including malformed timestamps.

New transcript tests exercise fetch and XHR response bodies, one-use signed URLs without replay, preserving the exact URL before a format change, temporary caption activation/restoration and respecting a user caption change during capture. These use controlled responses, not live YouTube data.

## Browser checks

- Real MiniLM embeddings found the expected paraphrased passages and timestamp links. Export/import, deletion, recency filters, pruning and persistent title search passed.
- The search UI kept previous results visible during debounce and rejected delayed results after clearing a query.
- Takeout imports remained title-only through backup/re-import, survived transcript retention and upgraded to a controlled transcript at 0:42. Re-importing history did not replace that transcript.
- Rewatching an already indexed video updated its watch date and Today-filter membership without re-embedding. Background transcript additions retained the imported watch date.
- Optional first-run import and Start empty passed. Starting empty left zero entries, granted no history permission and caused no model/history requests. Later import remained available.
- The importer accepted an actual 104,857,600-byte JSON file through the browser file input. The fixture held one valid record and valid trailing whitespace; it verifies the size limit and parsing path, not the speed or memory usage of a 100 MB history corpus.
- The model loaded and inference passed after removing the unused plain WASM/loader pair. The bundle references only the two .jsep runtime assets.

## Live YouTube results

Baseline: 3Blue1Brown video aircAruvnKk failed while captions were already on. Caption responses were HTTP 200 with zero-byte bodies; the transcript API returned HTTP 400.

V2 live attempts:

| Browser mode | Public video | Result | Caption state |
|---|---|---|---|
| Headless Chromium | aircAruvnKk | Capture failed: empty caption bodies, HTTP 400 transcript API | Off before, off after |
| Headless Chromium | dQw4w9WgXcQ | Capture failed: empty caption bodies, HTTP 400 transcript API | Off before, off after |
| Visible Chromium | aircAruvnKk | Same failure | Off before, off after |

Both video playback and the new activation fallback were exercised. No live transcript was indexed, so live timestamp accuracy and search quality on newly captured YouTube transcripts could not be verified. See LIVE-TEST-RESULTS.json for sanitized status/body-size evidence; it contains no signed caption URLs or user cookies.

A final visible-browser repeat after updating the transcript-panel selectors also failed. A separate comparison with Recall absent reproduced empty captions in both Chromium 151 and Edge 155: playback advanced normally, but enabling YouTube's own CC produced HTTP 200 responses with zero-byte bodies and no subtitle elements. This confirms the isolated-browser caption failure also occurs without the extension; it does not establish its server-side cause. The user's normal Edge session remains unverified.

The pattern is consistent with upstream reports of YouTube returning empty caption responses, but the exact server-side cause was not established. References: https://github.com/jdepoix/youtube-transcript-api/issues/592 and https://github.com/yt-dlp/yt-dlp/issues/13075 . A signed-in regular browser may behave differently; it was not tested.

## Package checks

The folder/ZIP identify the extension as Recall v2, version 2.0.0. The ZIP includes README.md, INSTALL.md, REVIEW.md, this report, raw live results, tests, source, the bundled browser runtime and license notices. It excludes node_modules, build-meta.json, the plain unused runtime pair, model weights, browser profiles and user history.

## Dependency audit and remaining limits

The unchanged lockfile audit still reports three high advisories in sharp and one moderate advisory in sprintf-js through onnxruntime-node. Build input metadata contains only Transformers.js, onnxruntime-web and onnxruntime-common from those dependencies. The affected native Node paths and node_modules are not shipped or used by the browser build. Installation scripts were disabled. Review this deferral before Node-side inference, image processing, dependency-script execution or production release, and no later than November 17, 2026. The source graph is not audit-clean.

The optional native history-permission prompt, a real user Takeout file, very large record-rich imports, actual offline operation, the advertised minimum Chrome version, Web Store review and regular Edge live capture were not verified. No new dependency or permission was added for v2.
