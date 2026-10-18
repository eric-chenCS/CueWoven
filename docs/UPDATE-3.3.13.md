# Recall v3.3.13: safer filters and predictable warm search

## Changes

- Date inference now needs viewing context such as `I watched last week`, `a TikTok from last week`, or `earlier today`. Ordinary phrases including `the short answer`, `before today`, `Today Explained`, `the past week of the war` and `how to grow on YouTube` remain topic searches.
- Platform words stay in the query. The popup shows inferred filters with an **Ignore suggested filters** button. If the inferred restrictions find nothing on the first page, search retries without those automatic restrictions and explains the fallback. Manual dates, result type and current-video scope remain in force. Reaching the last result page does not relax filters.
- Common silent-e and `-ed` collisions are repaired: care/caring, hope/hoping, hop/hopping, speed/speeds/speeding, and news/new. Exact quoted-phrase bonuses stay literal.
- Passage word normalization is reused in memory; repeated words are compacted because lexical coverage needs presence, not repetition. Main-index rows use weak references with a 16 MiB estimated normalized-word budget; re-read short website passages have a separate 2 MiB estimated text-cache budget. These are cache accounting budgets, not a claim about total JavaScript heap usage. Text changes invalidate entries. Deletion clears the cache and stops older incremental preparation. Cache entries are not written to IndexedDB.
- Large index preparation yields about every 8 ms. The redundant “Only last week?” suggestion is removed. Empty-state guidance uses the effective date filter.

## Validation on this machine

- **282 automated tests pass**, including cache lifecycle, changed text, budget eviction, inference false positives, manual-filter preservation, fallback, pagination and stem collisions.
- Real Chromium extension with production q8 MiniLM: **120/121 top-1, 121/121 top-5 and top-20** on the same-topic fixture. TikTok/Reels source/date retrieval, fallback and the popup ignore-filter action pass with no page errors.
- An isolated copy of the existing **2,511-item personal library** keeps **41/41 development checks**. Warm end-to-end background search: v3.3.12 median **17.4 ms**, p95 **22.8 ms**; v3.3.13 median **15.7 ms**, p95 **19.9 ms**. These small differences are not claimed as a statistically established speedup. Cached model plus library warmup was about **0.85 seconds** in the title-heavy library.
- Transcript stress test: 30,000 passages of about 183 words. Numeric queries that took roughly **1.7 seconds** in v3.3.12 now rank in **72–75 ms** after preparation; the nonnumeric query ranks in **69–70 ms**, versus about **180 ms** in the reviewed baseline. The 400 ms ranking guard includes all three queries in `node tests/bench/lexical.mjs`.
- **Cold preparation is separate:** that deliberately large transcript fixture took **3.4 seconds** once, with **217 yields**. It must be rebuilt after a new snapshot, extension reload, or cache reset; warm results do not describe the first-ever large-library load. The existing popup debounce adds 250 ms. Network model downloads are excluded.

The personal-library checks remain development queries derived from titles, not a blind evaluation of 30–50 human-authored searches. The imported history contains titles and visit dates rather than captured transcripts/scenes. No personal history, queries, vectors, names or screenshots are included in the repository or archive.

## Model decision

Keep MiniLM for this release. The remaining synthetic miss is present in the top five, so a re-ranker could potentially fix it; this set provides at most one top-1 improvement out of 121 and does not establish a worthwhile real-user gain. No re-ranker or embedding migration is shipped. The browser test now reports top-1/top-5/top-20 candidate recall, ready for a broader human-labeled test. A later re-ranker trial must measure cold/warm latency and memory, keep results stable after interaction, preserve explicit filters, and test score calibration.

## Dependency audit

The unchanged lockfile still reports three high Node-only `sharp` advisories and one moderate Node-only `sprintf-js` advisory. Neither module is in the shipped browser bundle. Node-toolchain remediation remains deferred for review by 2026-11-17, as documented in the earlier release notes. No dependencies or model downloads were added; the audit is not clean.
