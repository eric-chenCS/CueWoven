# Working on CueWoven

## Build from source

Use Node.js 22+ and pnpm 11.25.0. Run `pnpm install --frozen-lockfile --ignore-scripts` followed by `pnpm run vendor` on a fresh clone, then load the repository root as an unpacked extension. The generated `vendor/` runtime is required but stays out of Git. This applies to both clones and GitHub source ZIPs. To install without a development toolchain, use the named [release asset](https://github.com/eric-chenCS/CueWoven/releases/latest) instead. See [INSTALL.md](INSTALL.md) for the complete loading, refresh and troubleshooting steps.

The workspace omits Transformers.js's native `sharp` and `onnxruntime-node` dependencies because this extension uses its browser implementation. Node-side inference is outside this project's build setup. Keep installation scripts blocked and rebuild the browser runtime after dependency changes.

Before release, run `pnpm audit --json --fetch-retries=0 --fetch-timeout=15000`. Use normal Node execution for pnpm: `--jitless` disables WebAssembly needed by its HTTP parser and can make the audit appear to hang. An audit error or timeout is incomplete validation; a completed audit with findings still requires review.

## Make a change

Make small changes on a branch, run `pnpm test`, and open a pull request. Check the affected behavior in the browser too: Node tests do not prove live YouTube caption availability. Content scripts require refreshing YouTube tabs after reloading the extension. Rebuild with `pnpm run vendor` after changing `scripts/embedder-entry.js`, `scripts/vendor.mjs`, or the dependency graph.

Keep video metadata, transcript validation, original watch dates, optional site permissions and backup recovery intact. Do not commit watch history, CueWoven backups, browser profiles, cookies, credentials, model weights or generated bundles. No personal YouTube API key is required.

## Browser checks

Run the maintained regression set with `pnpm run test:browser`, or select checks such as `node scripts/browser-tests.mjs transcript-dom release-ui late-captions`. This covers sixteen regression programs; it does not run every historical benchmark in `tests/browser`. Programs run sequentially to limit competing model loads. The speech cancellation check uses controlled pending inference in a real browser Worker, without downloading Whisper or recording microphone audio. The confirmation check includes delayed requests, overlapping prompts and preservation of data when approval is cancelled. The text-runtime loader check verifies non-streaming initialization, missing/corrupt runtime errors and recovery with real MiniLM inference.

Set `RECALL_PLAYWRIGHT` to an installed Playwright module path and `RECALL_BROWSER` to a compatible Edge/Chromium executable. With `RECALL_MODEL_DIR` set, the runner checks required MiniLM/CLIP files before starting each applicable program. A text-only fixture blocks visual checks rather than reporting them as product failures. Without that override, programs can download their models. Missing setup is **BLOCKED**, assertion/runtime errors after launch are **FAILED**, and successful checks are **PASSED**. Exit codes are 0 for all passed, 1 for any failure, and 2 for blocked/incomplete setup. A failed check takes precedence over blocked ones; never report a blocked run as clean.

Each run writes per-check logs and `results.json` to a fresh directory under `RECALL_REPORT_DIR` (the system temporary folder by default). Set `RECALL_TEST_ROOT` to an existing short scratch path on Windows to avoid profile-path limits. Browser profiles contain test data and may be large; close their browsers before deleting owned scratch folders. These checks neither diagnose nor automatically skip arbitrary failures in the older experiments below. Missing fixtures are identified before launch; corrupt or incompatible fixtures still fail when exercised.

For the optional real speech-capture check, run `node tests/browser/speech-late-captions.cjs` with `RECALL_SPEECH_WAV` pointing to spoken audio and `RECALL_SPEECH_MODEL_DIR` pointing to cached `Xenova/whisper-tiny.en` assets. Use `RECALL_MODEL_DIR` for the MiniLM fixture as above. It plays audio on controlled YouTube pages through the actual AudioWorklet and local models, verifies late captions stop speech and its badge, and checks that a normal video end still saves buffered speech. This complements a manual check on real YouTube in a normal browser profile; it does not establish live caption availability.

The optional `node tests/browser/onnx-wasm-workers.cjs` additionally needs the full MiniLM/CLIP fixture in `RECALL_MODEL_DIR`, the speech variables above, and `RECALL_ETTIN_MODELS` pointing to the pinned Ettin asset folder. It checks missing/corrupt runtime errors and fresh-worker recovery for speech, both CLIP encoders and reranking, with one local WASM fetch per worker and no streaming compilation. These extra model requirements keep it separate from the maintained suite.

For the optional browser regression, install Playwright separately from the project's production dependencies. Set `RECALL_PLAYWRIGHT` to its module path and `RECALL_BROWSER` to a Chromium executable that supports loading unpacked extensions, then run:

```sh
node tests/browser/backup-simplification.cjs
node tests/browser/refine-search.cjs
node tests/browser/single-video.cjs
node tests/browser/video-scope.cjs
node tests/browser/article-jump.cjs
node tests/browser/article-suggestion.cjs
node tests/browser/device-lite.cjs
node tests/browser/detail-guidance.cjs
node tests/browser/resource-lifecycle.cjs
node tests/browser/scene-default.cjs
node tests/browser/visual-setting.cjs
node tests/browser/enter-search.cjs
node tests/browser/adaptive-scenes.cjs
node tests/browser/security-hardening.cjs
node tests/browser/visual-fallback.cjs
```

These use controlled YouTube/transcript outcomes with the real local embedding/search engine. They can download model weights, create isolated temporary browser profiles, and do not use your normal browser history or cookies. The background test uses the real service worker and temporary tabs to verify processing continues after settings closes.

`video-scope.cjs` checks **Search this video** with saved captions, local speech, real OCR and CLIP scenes, including preserved timestamps, paused capture, switching back to library search, initial caption capture and unavailable captions. Saved moment evidence must remain searchable without another caption request; a saved title alone still triggers initial capture.

`article-jump.cjs` reproduces exact-phrase searches through the popup and real model, then verifies on-page highlight ranges for repeated phrases, paragraph and inline boundaries, long phrases, punctuation, late rendering and removed text. Pages are controlled fixtures; the script does not browse personal articles.

`article-suggestion.cjs` verifies that semantic article results scroll without native or extension text highlights, display a suggested-section label, dismiss it on website interaction and cancel pending late-render jumps. It uses real Edge input events, including emulated touch, and checks that exact phrase highlighting remains available.

`device-lite.cjs` checks automatic Lite defaults with controlled physical-memory responses in isolated extension copies. It covers fresh setup, first upgrade, manual overrides, reset, unavailable hardware detection, media capture gates, responsive Settings and real-model text search. These are browser integration checks, not measurements on a physical 8 GB laptop.

`detail-guidance.cjs` uses controlled search outcomes in the real popup to verify constructive no-match wording, optional refinement for related/near-tied results, short strong queries, keyboard focus, user-written clues, error handling and the existing 440 px popup layout. Scoped-video and Enter-search suites cover real inference and submission regressions separately.

`resource-lifecycle.cjs` verifies that text warmup and strong text searches keep CLIP unloaded despite saved scenes, then checks actual visual fallback, preserved timestamps and cached text-worker reload. With `RECALL_MODEL_DIR` set, its performance acceptance requires a completed first visual response within two seconds on the test setup; first-download or slower-hardware behavior is not certified by that check. The text reload subtest uses an accelerated idle timeout; default 60-second retention is covered separately by the Node timer test and measured idle trial.

`scene-default.cjs` checks the combined visual control, fresh Off defaults, the visible RAM/CPU warning, legacy mixed preferences, opt-in persistence, reset and preservation of real-model saved-scene search. `visual-setting.cjs` checks actual article-image capture with the shared switch Off, On and Off again, while retaining page text and previously saved images. The Node scene-default tests also verify that classic capture schedules no frame probes without explicit opt-in.

After pulling merged changes, run `pnpm run setup` if dependencies or the runtime build changed. Reload the extension, reopen its settings page, and refresh YouTube tabs. Keeping the checkout folder path stable preserves its extension identity. Export your index before switching to another folder or removing an installation.

## Search stress and capture progress checks

`node tests/browser/capture-progress.cjs` checks the fresh 10-second watch delay, visible preparation, real transcript indexing and search, caption failure, reopening the popup, pause and exclusion. `node tests/browser/preferences.cjs` checks the default label, reset and preference preservation.

`node tests/browser/search-stress.cjs` runs 1,000 queries against 41 controlled videos using the actual MiniLM model, with scenes disabled. Set `RECALL_MODEL_DIR` to a local directory containing `Xenova/all-MiniLM-L6-v2` (and the shared fixture's `Xenova/clip-vit-base-patch32` model files); set `RECALL_TEST_ROOT` to a scratch directory and `RECALL_REPORT_DIR` to the report directory. The suite writes `cuewoven-search-1000.json` with every query, expected video, top results, latency and misses.

The 1,000 cases comprise 726 transformations of 121 existing seeds, 108 new hard paraphrases, 16 queries about the user-provided aging/back-pain transcript, 100 typo variants, 25 ambiguous queries with several acceptable answers, and 25 topics absent from the library. These are controlled and partly correlated cases, not a real-user accuracy estimate. The user-case title is a neutral fixture label, not verified live YouTube metadata. Corpus text includes deliberately similar distractors. Expectations are fixed before running; do not tune the ranker just to turn this report green.

The initial run kept the original baseline at 121/121. Among 950 specific queries, the correct video was first in 893 and in the first five in 942. The original aging/back-pain query initially ranked the intended video second with close distractors. Bounded comparative word matching now connects old/older and similar forms: both original query spellings rank first; 13/16 user-transcript queries rank first and all 16 are in the first five. Specific-query first-place results rose from 893/950 to 896/950, with no lost first-place results in this suite. Quotes, embeddings and displayed text remain literal. Absent topics returned no results in only 3/25 cases, although none of their first results was labelled Close. Similarity search can return Related items even when the requested topic is absent. Keep remaining misses visible; this suite is a diagnostic, not a claim that every query passes.

For a paired fresh-case check, set `RECALL_BASELINE_EXTENSION` to a source/runtime snapshot from before the lexical change, then run `node tests/browser/search-fresh.cjs` with the same model and report variables. It evaluates 120 additional cases (80 authored paraphrases plus 40 conversational/typo variants) against 61 competing videos, writing `cuewoven-search-fresh-comparison.json`. Baseline and final code both scored 115/120 first and 117/120 within five, with no changed first-place outcomes. This validation set was frozen before experiments, used to reject prefix cleanup and validate a predefined comparative-only alternative; it is not an untouched independent holdout. Query times cover warmed local model/engine requests, not first-install downloads or full popup interaction. See [search evaluation](docs/SEARCH-EVALUATION.md) for the comparison and remaining limits.

## Optional reranker and rewrite experiments

The current local implementation uses selective Ettin 32M q8; see [its runtime contract and tests](docs/SELECTIVE-RERANKING.md). The older MiniLM/rewriter runners below remain research comparisons and do not configure the production model.

See [the search-method study](docs/SEARCH-METHODS.md) for the measured alternatives and known limits. These runners do not enable a new model in the app. Download extra model data into a scratch directory with `python tests/browser/download-search-method-models.py <directory>`; add `--fp32` only for the precision control. Revisions and file hashes are verified. Keep the downloaded models and generated browser profiles outside Git.

Set `RECALL_METHOD_MODELS` to that model directory, plus the existing `RECALL_MODEL_DIR`, `RECALL_PLAYWRIGHT`, `RECALL_BROWSER`, `RECALL_TEST_ROOT` and `RECALL_REPORT_DIR` variables. Then run `node tests/browser/search-methods.cjs`, `node tests/browser/search-rewriter-validation.cjs`, and `node tests/browser/search-reranker-confirm.cjs`. The optional `node tests/browser/rewriter-precision.cjs` needs the full-precision weights. The method runner reports comparisons and regressions rather than pretending every tested method passes; the confirmation runner protects correct results for the conservative candidate. The tested generative rewriter failed sanity controls, so its results do not justify deployment.

## Package a download

Run `pnpm run zip` after building the runtime. The ZIP includes `vendor/` and can be loaded after extraction; GitHub source archives need a build. Inspect the archive before attaching it to a release. Keep the version in `manifest.json` and `package.json` consistent and describe user-facing behavior in release notes, rather than adding a running changelog to the README.

## Collaboration

Create a branch from current main, commit your work, push the branch and open a pull request. Teammates pull after merge and reload their installed checkout. Content-script changes also need a page refresh. Owner/admin permissions can differ from contributor permissions; follow the repository's active rules.
