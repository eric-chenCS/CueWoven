# Recall test report

## Version 3.0.0 update

All 188 Node tests pass. General-history file imports, actual semantic page capture/search, optional-access and private-page gates, video caption/scene/OCR/audio integration, backup restore, bounded storage, source filters and responsive light/dark UI pass in isolated Chromium. Existing YouTube scene/storage, mutation holds, import integrity, automatic speech and six-player background transcript regressions also pass. Inverting the website-enabled guard deliberately fails the regression suite. A real Wikipedia article saved successfully; production TikTok was connection-reset and Instagram exposed no playing video. Controlled social-origin players pass; production social compatibility and the browser's native optional-permission dialog remain unverified. See [UPDATE-3.0.md](UPDATE-3.0.md) for coverage, privacy/storage limits and unchanged dependency findings. Historical results below describe their original versions.

## Version 2.15.0 update

All 168 Node tests pass. The adaptive scene browser test verifies a brief real video-frame event between routine snapshots, scene search at its timestamp, quiet checkpoint suppression, the shared six-extra budget, independent frame keys and backup restore. Existing scene, capture-hold, OCR and import-integrity browser regressions are included. See [UPDATE-2.15.md](UPDATE-2.15.md) for the measured probe cost, mutation check, storage/processing limits and controlled-video test scope. Historical results below describe their original versions.

## Version 2.14.0 update

All 156 Node tests and the real-model browser regressions listed in [UPDATE-2.14.md](UPDATE-2.14.md) pass. The update covers exclusive capture holds, restore during scene search, OCR cancellation during Delete/Clear, conservative exact-line deduplication, changing numbers/negation, watermark filtering, bounded observation metadata and playback-only lead-in. The release notes document the frame microbenchmark, mutation check, unchanged dependencies and sampled-English/live-test limitations. Historical results below describe their original versions.

## Version 2.13.0 update

See [UPDATE-2.13.md](UPDATE-2.13.md) for the 145-test result, real OCR/video/search and storage-budget checks, measured timings, existing browser regressions, dependency review and the unsuccessful public-player attempt. OCR reads sampled English video pixels and stores words with a timestamp; it does not establish exact subtitle onset/end or complete coverage. Existing results below describe their original versions.

## Version 2.12.0 update

All 131 Node tests pass. New checks cover imported-transcript retention beyond 31 days, mixed uploaded-caption language ordering, original/ASR precedence, automatic guard versus manual speech override, all supplied Whisper-noise examples, bounded scene-busy restore retries, no duplicate progress and immediate handling of speech/invalid-data/transport failures. Reinstating the title-only import exemption deliberately failed its regression and was restored. The failure bridge now has a title assertion.

The import-integrity browser test uses actual MiniLM, CLIP and IndexedDB. It saves a background transcript for an imported video, ages it 31 days and verifies retention; repairs missing provenance using matching Takeout watch dates; verifies a newer live watch wins; starts genuine scene inference while restoring through the actual file input and observes successful retries. An older backup also cannot restore exemption over a newer live watch. The extracted v2.12 ZIP passed this full import-integrity regression and the legacy-library upgrade check. Its rendered notices contain actual titles and fade after five seconds even with intermediate/replayed job updates, while summary counts remain. The notice screenshot was inspected.

The real six-player background capture regression passed and checks imported flags plus actual returned titles. Both 53-video import regressions passed; the Takeout test explicitly verifies protection survives transcript upgrades. The actual player-audio/Whisper test passed with the popup manually starting despite intentionally incorrect Spanish metadata, preserved partial coverage and Stop/end/settings cleanup. Local speech clears the import exemption because it represents watched portions. Scene search/storage/file-input restore, legacy-vector upgrade and default search keyboard browser regressions also pass. UI race events, caption responses and spoken fixtures are controlled; model inference, media playback, storage and application code are real. No new public YouTube/live-account test or general ASR accuracy benchmark is claimed for this release.

Existing imports with an already-lost flag cannot be identified reliably from saved transcript text alone. Re-import the original Takeout file to repair exact watch-date matches; completed transcripts are preserved. Explicit watched flags/newer dates remain unchanged. A scene job exceeding the 6.5-second retry window can still stop restore with durable partial progress. Manual speech is still English-only, and conservative metadata/tag filters can decline genuine English videos or remove genuine standalone stock phrases. Minimum-browser compatibility and general sampled-scene limitations remain documented below.

No dependency, lockfile, runtime bundle or permission changed. Native pnpm audit remains 3 high sharp and 1 moderate sprintf-js advisories in the native Node graph, excluded from the shipped browser runtime. The source graph is not audit-clean. Package tests and file hashes are checked before installation; profiles, model weights and user data are excluded.

## Version 2.11.0 update

All 126 Node tests pass. New regressions cover the 0.23-scene decoy versus 0.80/0.40 transcripts, the 0.26 scene cutoff, music/filler filtering without stripping ordinary sentences, original/ASR language precedence and non-English speech guards, watched-title retention, A → home → A announcements, localized Takeout prefixes, bounded backup requests with durable failure progress, coalesced visual warmup and image work waiting for it. Lowering the cutoff back to 0.22 deliberately failed the scene regression and was restored.

The new keyboard browser test passed Enter on the current match, Enter immediately after edits, stale delayed responses, Ctrl+Enter, arrow-page selection, list selection, blank input and popup scene warmup routing. The real-model scene browser regression passed the tightened cutoff (a cat fixture matched about 0.281), unified indicators, transcript timestamp 0:42, repeated same-tab navigation with resumed scenes/recency, scene-only expiry versus imported-title retention, and backup restoration through the actual file input with one video/image per request. It also retains schema upgrade, previews/arrows, backup scenes, caps, pruning and deletion coverage. The initial run exposed missing matchSources in the all-scenes-rejected text fallback; the ranker now always supplies source labels and the regression passes.

The extracted v2.11 ZIP also passed the keyboard and real-model scene/navigation/retention/file-input restore regressions. The automatic speech/player PCM regression, single-video navigation, refinement, minimized six-player background caption queue, both 53-video import regressions and 65-chunk legacy upgrade also passed. Caption pages/outcomes and UI race responses are controlled; model inference, media playback, encoding, storage and application code run for real. The 31-query synthetic text fixture remains 31/31 first moments using the existing cached real-model vectors; this does not measure broad real-user accuracy. Light/dark scene screenshots were inspected for this change.

A fresh live public YouTube check saved scene and speech-local data from jNQXAC9IVRw with no mocked video/image/model responses or personal profile. Its normal visual query returned a Scene result around 0:11.57 at the higher cutoff. See LIVE-SCENES-2.11.json. No universal scene/ASR accuracy, minimum-browser compatibility, sustained hardware-load result or numerical warmup latency gain is claimed. Unknown languages still reach the English fallback, and standalone filler filtering can remove genuine stock phrases. Backup batching limits work to one video/image per request; a pathological single transcript can still take time.

No dependency, lockfile or permission changed. The rerun native pnpm audit remains 3 high sharp advisories and 1 moderate sprintf-js advisory in the native Node graph outside the shipped browser bundle; the source graph is not audit-clean. Release evidence is organized under docs/ with README/INSTALL links updated.

## Version 2.10.0 update

All 113 Node tests pass. New checks cover semantic-versus-weak-literal ranking, exact quoted speech, word boundaries, accents/Unicode, title eligibility, unified Audio/Scene evidence, embedding recipes, batch progress/retry, and revision-safe cache invalidation. Disabling phrase matching deliberately failed the regression; it was restored. No dependency, lockfile or permission changed.

The fixed 15-video, 31-query synthetic benchmark uses real q8 models. Previous main returned the correct first video in 30/31 and exact first moment in 29/31; unmodified ma-copy scored 29/31 for both; v2.10 scored 31/31 for both. Body-only embedding alone also scored 31/31, so this fixture does not isolate the impact of every ranking change. MiniLM and BGE-small tied. Whisper tiny.en and base.en each had zero normalized word errors on one generated English passage in clean, noisy and faster variants. Bigger models are not shipped. These limited, development-visible fixtures are regression checks, not general accuracy estimates. See RETRIEVAL-EVAL-2.10.json, SPEECH-EVAL-2.10.json and MA-COPY-REVIEW.md.

The real-model legacy upgrade browser test passed 65 old chunks, including partial audio with ranges and a saved scene. It checks unchanged chunk IDs/text/times, video dates/metadata, correct Audio rendering at 0:42 without percentages, a later watch date, concurrent full-caption replacement and deletion without resurrection. The scene regression, automatic speech regression, both 53-video imports, single-video arrows and refinement passed. A background-window regression timed out once waiting 10 seconds for the manual-close Paused UI; it then passed alone with diagnostic output enabled. The first timeout's cause remains unconfirmed, so that run is not reported as an uninterrupted full-suite pass. The extracted v2.10 package also passed the legacy-upgrade and background-window regressions; the manual-close path completed on that packaged run.

A live public YouTube check with no user profile/cookies/history saved a real scene and speech-local transcript from jNQXAC9IVRw. A visual description returned a Scene result around 0:11.6, with a saved JPEG data URL of 11,335 characters. Video/image/model responses were not mocked; the short video looped from 0:09. See LIVE-SCENES-2.10.json. One public video does not certify all players or visual/audio descriptions.

The native pnpm audit was rerun and still reports 3 high sharp advisories and 1 moderate sprintf-js advisory in the existing Node graph. Those native paths and node_modules are excluded from the browser bundle/package; the source dependency graph is not audit-clean. Model weights, synthetic vector caches, test audio, private data and browser profiles are not packaged. Review deferral and compatibility limits remain documented below. Sustained playback load and a broad real-user accuracy corpus were not tested.

## Version 2.9.0 update

All 101 Node tests pass. New checks cover sampled capture, pauses/visibility/seeks/ads, forced-history exclusion, off switches, source validation, JPEG dimensions/size, bounded visual inference, latest-query replacement, cancel/retry, independent visual ranking, evidence fusion, strong transcript timestamps and 50-video mixed pagination. Removing the scene ad guard failed its test and was restored. No dependency or browser permission was added; the runtime build now exposes CLIP classes from the existing dependency.

The real-model scene browser test passed: actual canvas-to-video playback, automatic snapshots, CLIP image/text embeddings and MiniLM produce a visual-only cat scene match and a separate battery transcript match at 0:42 through the same search. It verifies Scene/Transcript evidence, image previews, timestamp URLs, arrows and absence of a search-mode selector. Existing v1 transcript data survives the schema upgrade. Backup restore retains scene search; 1,030 seeded images plus a new image trim correctly to 1,000 total and 120 per video, with counts, pruning and video deletion verified. Light/dark UI screenshots were inspected and no horizontal overflow was found. Video pages and visual fixture content are controlled; the models, media playback, frame encoder, storage and application code are real.

A separate live check successfully saved a scene from YouTube video `jNQXAC9IVRw` and automatically captured speech in the same session. The normal query for a man in front of elephants at a zoo returned the video around 0:11 with both AI speech and Scene indicators. Its saved JPEG data URL was 11,323 characters. No video/image/model responses were mocked and no user profile/history/cookies were read. The short video was started at 0:09 and looped for the test. See LIVE-SCENES-2.9.json. This proves one public-video path, not every video, language or protected player.

The independent CLIP test matched a public cat image to the cat description over airplane/car descriptions (cosine values about 0.277, 0.181 and 0.197). Preparing/embedding that image took 3,678 ms in this isolated run; it includes model initialization/download effects and is not an inference-only or device-wide benchmark. Samples can miss brief moments; model ranking and the 15-second nearby-evidence merge remain approximate. Raw image vectors are not compared directly to MiniLM scores or shown as a probability.

The speech-to-text browser test, both 53-video imports, existing arrow/refinement tests and background caption queue regression were rerun for this release. Their detailed results appear in the release review. The native Node dependency audit remains documented below; model weights and native Node paths are not packaged. Sustained playback performance, arbitrary visual queries, offline operation, minimum browser version and regular-profile Edge behavior were not certified by these isolated tests.

## Version 2.8.0 update

All 87 Node tests pass, including automatic caption-failure fallback, deferred start after paused playback, exclusion of history capture tabs, off switches, sender validation, timestamp mapping, ads/pause/seek/rate handling, bounded recognition backlog, failure/cancellation and player-audio cleanup. Removing the pause/ad exclusion deliberately failed the speech regression; the mutation was restored. No dependency or browser permission was added. The existing audit remains 3 high and 1 moderate findings in native Node dependencies, with the browser reachability limits recorded below.

The isolated browser test passed using actual HTML media playback, an audio worklet, local quantized Whisper tiny.en, local MiniLM, IndexedDB and the real search/popup code. Only the YouTube page and a generated spoken WAV are controlled. It starts after a normal Play click, without a recording button or microphone/tabCapture permission. It verifies partial AI labels, played timestamps, title-only upgrade, incremental append, overlapping rewatch replacement, watch recency, concurrent full-caption protection, semantic search, Stop, natural video end and the settings off switch. Preparation cancellation is also checked before an audio module can finish opening. Speech recognition on the fixture is imperfect; it is explicitly presented as AI-generated partial coverage, never an exact transcript guarantee.

A separate live public-video test **successfully saved automatic speech** from YouTube video `jNQXAC9IVRw` after caption retrieval failed. The live player exposed usable audio, Recall saved `speech-local` results, and searching for elephants at the zoo returned that video at approximately 0:12 with the AI speech marker. The player was looped for this short test. No caption/audio responses were mocked and no user profile/cookies/history were read. See LIVE-SPEECH-2.8.json. This verifies one public video in isolated Chromium, not every video, language, protected player, browser version or the user's regular Edge profile.

Both existing 53-video history-import tests, single-video navigation, search refinement and the full six-player background queue regression also passed. Queue completion with settings closed, pause, window cleanup, original dates and coalesced refresh remain covered. Caption bodies in these regression tests are controlled. The speech feature does not transcribe imported videos in bulk. First use downloads speech weights, then recognizes only portions played after capture starts, using extra CPU. Raw audio is held in bounded memory and is not persisted or uploaded. Actual offline operation, minimum Chrome version and sustained device memory/CPU were not benchmarked.

The earlier speech restart test initially observed UI/backend timing incorrectly. Explicit backend-state polling plus waiting for actual media end replaced that ambiguous check; Stop, ended and off-switch outcomes were then independently asserted. Historical reports below describe their respective releases.

## Version 2.7.0 update

All 62 Node tests pass. They cover shared window creation, minimized/unfocused options, recovery, navigated/moved anchors, preserving user-added tabs, manual closure without recreation, cleanup before reporting a job finished, and cleanup failures. A headed Windows Chromium test verified six simultaneous muted capture tabs in one separate minimized window, unchanged main-window focus and no capture tabs in its tab bar. Eight controlled videos completed while all settings pages were closed; restored progress, original dates, real-model search at 0:42, pause, manual window closure, already-indexed skips and coalesced refresh passed. Both 53-video history-import regressions also passed.

The window behavior was tested in a real headed browser as well as an isolated browser harness. Caption bodies in the successful eight-video regression are controlled. A separate live public-video run confirmed minimized/unfocused state, zero main-window capture tabs and automatic window cleanup, but YouTube still returned empty caption responses and transcript API HTTP 400 in that isolated session. Successful live caption capture is **not** claimed for this session; the user's previously confirmed Edge capture path remains in use. See [live results](LIVE-WINDOW-2.7.json) and UPDATE-2.7.md. No real-device memory or account-wide throughput improvement is claimed.

The v2.6 direct-request helper, no-tab selector and two-tab fallback are removed. The completion-refresh optimization is retained. No dependency or permission changed. Historical version reports below describe their respective releases.


## Version 2.6.0 update

All 66 Node tests pass, including bounded response parsing, signed URL preservation, XML/JSON captions, transcript API fallback, caption host/video validation, rate limits, and the two-tab mode cap. A reversed-host-validation mutation failed these tests and was restored. Both 53-video Takeout and browser-history regressions passed with the existing queue, original watch dates, title preservation, pause and timestamp search.

The real service-worker no-tab browser test completed 14 controlled videos with 12 concurrent requests and zero YouTube tabs while settings pages were closed. It verified restored progress, pause, real-model search at 0:42, blocked-caption title retention, HTTP 429 automatic pause, and settings persistence. A completion burst produced one library read/refresh; replacing coalescing with the previous immediate behavior produced 30 reads and failed the guard. The separate compatibility browser test forced direct requests to fail and verified opt-in fallback: at most two muted inactive tabs despite selecting parallel limit 12, all four videos indexed, then a five-video job paused after its two active videos. Capture tabs were cleaned up.

A live public-video check in an isolated browser opened zero YouTube tabs but did **not** obtain captions: YouTube returned empty signed captions and the extension reported that its player is needed. The hidden embedded-player experiment also returned a player configuration error and is not shipped. This release does not claim all captions can be fetched invisibly. See [live results](LIVE-NO-TABS-2.6.json), [performance experiments](PERF.md), and UPDATE-2.6.md. The previously user-confirmed live capture path remains unchanged.

No permissions or dependencies changed. Package-manager audit still reports the existing 3 high and 1 moderate native/development dependency findings (sharp and sprintf-js); browser-bundle reachability limits remain documented below. No real-user RAM, CPU, or account-wide throughput benchmark is claimed.


## Version 2.5.0 update

All 55 Node tests pass. Queue tests cover 3, 6, 8, 12 and the default of 6, and reject invalid/unbounded limits. A deliberate inverted-validation mutation failed the tests and was restored. Both 53-video history-import browser regressions passed with the new six-video default, including pause, title-only opt-out, failure preservation and real-model transcript search at 0:42.

The real service-worker browser test selected 12 through settings, verified persistence after reload, fetched 14 controlled videos while all settings pages were closed, then paused a 15-video job after its 12 active videos. Tabs stayed inactive and muted and closed afterward. Original watch dates and restored progress passed. These tests use controlled YouTube responses; no live account-wide throughput benchmark was performed. Twelve tabs can use substantial memory and YouTube may throttle requests.


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
