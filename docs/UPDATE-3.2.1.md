# Recall 3.2.1 — conservative OCR merging and safer workers

Selected fixes were applied directly to main after reviewing ma-copy commit `135bf1c`. The branch was not merged. Its fuzzy word-overlap matcher and license-only whitespace change were not adopted. No model, dependency, permission or database-schema change is required.

## Changes

- OCR merges exact ordered, whitespace-delimited token fragments in either order and keeps the fuller line. Token punctuation is preserved, so C/C++, decimal values and percentages are not treated as interchangeable. Changed numbers, negation and reversed names in the regression corpus survive. The same helper merges lines within a pass and between the subtitle and full-frame passes; short fragments no longer accumulate just because they arrived first.
- The full-frame pass uses Tesseract's automatic layout mode. The sparse mode missed upper boxed overlays in the real-browser fixture before text merging. Automatic layout recovers both overlays, including their different numbers or negation. The subtitle-focused pass remains, and there are still two recognition passes per frame.
- Screenshot dimensions must be positive integers within the existing 1280 × 720 limit before loading OCR. One active worker, the inference deadline, idle disposal, output limits and five-second capture cadence remain in place.
- Cancellation is checked after each asynchronous worker stage. Late work cannot schedule another recognition pass or publish results after cancellation, and cannot disrupt a replacement job. Throwing/rejecting worker termination no longer masks the original recognition failure or interrupts controller cleanup.
- ZIP filenames now follow the manifest version automatically.

## Verification

- **212 Node tests pass.** Added tests include 20,000 generated comparisons (10 fixture families × 1,000 seeded variations × both orders), 4,000 fragment/duplicate layouts, and 1,000 cancellation timelines across loading, both parameter changes and both recognition stages. These are deterministic text and worker-controller simulations, not 25,000 real videos or AI inferences.
- The new fuller-fragment, dimension and cleanup regressions failed on the previous implementation. Removing the post-parameter cancellation guard also deliberately fails the cancellation simulation; the correct code was restored.
- **Real local English OCR:** 56 generated frames retain all 104 expected lines, covering boxed/light backgrounds, 32–44px Arial fonts, both overlay positions and isolated labels. The tested pairs include changed doses, negation and reversed names. The source and extracted release package both pass; first-frame latency varied from 305 to 1,011 ms, while subsequent-frame median/p95 were 112/about 173 ms. These are fixture observations, not a universal OCR-accuracy or latency guarantee.
- **Browser capture flow:** automatic burned-in subtitle capture, actual semantic search, playback links with the existing three-second lead-in, caption upgrades, watermark suppression, backup restoration and deletion pass. A separate changing-caption fixture saves the four expected rows for 10 mg, 11 mg, safe and not-safe captions, with the correct timestamp returned for the negated query.
- **Release-package cancellation:** real CLIP-search/restore coordination and OCR deletion/clearing during capture pass. Canceled frames leave no saved video/text, and a later capture succeeds. Concurrent Clear is rejected during an exclusive restore.
- **30,000-passage rank guard:** 140 ms against the existing 400 ms budget. This measures in-memory ranking on synthetic 183-word passages, excluding model loading, query embedding and IndexedDB. The historical unprepared-text comparison took 1,399 ms; this release does not change the ranker.

- **50,000 titles + 600 full 2,000-word pages:** the completed side-by-side browser run passed retrieval, deletion/import cache invalidation and unchanged 1,000/50 ms new-query/arrow p95 budgets. The candidate measured 781 ms median, 982 ms p95 and 3 ms arrow p95; the v3.2 package measured 548/824/4 ms. Saved vectors are synthetic zeros; IndexedDB and MiniLM query embeddings are real, and runtime/model loading is excluded. The ranker, web search engine and runtime files are byte-identical between these versions; these observations do not establish a search-speed improvement or explain the latency variation.

The first large-library attempt recorded 553/816/3 ms before its browser closed during the final invalidation checks, so that attempt is not counted as a full pass. A second completed functional run measured 767/1,022/3 ms and failed the existing new-query budget by 22 ms. The final comparison passed without changing thresholds. These failed attempts are retained in the validation record; large-library new queries do not consistently stay below one second on this test machine. The OCR-specific checks and 30,000-passage rank guard pass independently.

## Updating and limits

Reload Recall in the same installed folder and refresh existing video tabs. No runtime rebuild or history re-import is needed when updating from v3.2. Existing saved rows are preserved; these changes affect new OCR observations, not text that was never captured previously.

This remains English OCR of sampled video frames. Small/stylized text, other languages, motion blur, protected players and subtitles appearing between samples can still be missed. Exact contained fragments are merged without layout-position metadata; this is deliberately conservative about differing tokens but does not identify every independent caption region. The tests use controlled images and browser players, not personal history or a claim of production compatibility with every social platform. Dependency audit findings and models remain as documented in v3.2.

Run `pnpm test`, then the browser checks with `RECALL_PLAYWRIGHT` and `RECALL_BROWSER` configured:

```text
node tests/browser/ocr-overlays.cjs
node tests/browser/ocr-model.cjs
node tests/browser/ocr-accuracy.cjs
node tests/browser/screen-text.cjs
node tests/browser/web-large.cjs
node tests/bench/search.mjs
```
