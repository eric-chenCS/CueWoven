# Recall v3.3.11: faster, more reliable search

Common English word endings now share lexical evidence (rotate/rotation/rotating, tire/tires). Written numbers and digits match, including `ten percent` and `10%`. Exact quoted-phrase bonuses remain literal. The embedding model and stored vectors are unchanged; existing titles need no reindex.

Explicit viewing context such as `the TikTok about cooking last week`, `the Instagram Reel about cooking`, or `Roblox from YouTube past month` selects the site and a rolling date window. Applied filters appear in the popup. Clicking a date chip overrides inference; quote words that should remain literal. Context-only queries list recent matching items without invoking the model. `Short` selects YouTube, including videos whose imported metadata does not identify their format. This is English, conservative phrase recognition, not general natural-language understanding.

This release also includes the reviewed distinctive-word, title/channel, shared-source ranking, stable support and comparable-score near-tie changes. A website passage's owner ID is supplied to the shared ranker: real IndexedDB website passages do not contain that ID, which otherwise caused grouping failures and sorting exceptions.

## Validation

- 275 automated tests pass, including word forms, numbers, literal quotes, inference overrides and website ownership.
- Real Chromium extension, production q8 MiniLM: 119/121 same-topic questions find the intended video first. The two remaining misses are retained. Synthetic TikTok/Reels source and date retrieval passes; popup rendering produces no page errors.
- An isolated copy of the user's existing 2,511-item library was searched using its existing vectors and cached production model. Forty automatically generated title-based checks scored 38/40 with the website ownership fix alone, and 40/40 with this release. These are development checks, not a blind human-labeled evaluation. Original installed search threw on all forty checks before the ownership fix.
- Warm end-to-end background searches in that library: median 17 ms before versus 22 ms after; p95 26 ms versus 28 ms. The popup's existing 250 ms typing debounce is additional. Cached-model startup was about 0.8–0.9 seconds. First-ever model download time is excluded.
- Synthetic 30,000 full passages: ranking 158–169 ms before, 186–192 ms after, below the existing 400 ms budget. A rejected implementation took roughly 1.6–1.9 seconds on its first query. The shipped version tests variants only for query words; it does not stem every passage word or store another normalized index.
- Stored-vector regressions remain 121/121 clean and 120/121 caption-style text. These stored fixtures use quantized vectors generated from FP32 MiniLM and are separate from the production-q8 browser test.

The personal library contained title/visit-date imports, not transcripts or captured scenes. These checks establish title retrieval, not spoken-moment accuracy in that history. No personal queries, names, URLs, vectors or screenshots are committed. Ctrl+Shift+F and toolbar-icon access are preserved.

No larger model, re-ranker, click tracking or new dependency is added. Those need a separate accuracy/latency justification.

## Dependency audit

`pnpm audit --prod --json --fetch-retries=0` reports three high advisories on transitive Node-only `sharp` and one moderate advisory on Node-only `sprintf-js` via `onnxruntime-node`. These are existing lockfile dependencies; this release changes none. The shipped browser bundle contains none of those modules, and the vendor build explicitly targets `platform: browser`. Deferred Node-toolchain remediation should be reviewed by 2026-11-17; do not treat this as a clean dependency audit. No dependency install scripts were enabled for this release.
