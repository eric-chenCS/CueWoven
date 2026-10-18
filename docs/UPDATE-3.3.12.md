# Recall v3.3.12: accurate numbers without a heavier model

This contains the [v3.3.11 search improvements](UPDATE-3.3.11.md): word forms, number normalization, explicit date/site inference, shared ranking across sources, and the website owner-ID fix. Titles were already indexed; no history rebuild or additional model is needed. Toolbar-icon and Ctrl+Shift+F access remain available.

A natural query tested in the installed popup, `building log cabin by hand part five`, still preferred a saved search for part six by 0.004 points. Exact numeric evidence now contributes a small bounded bonus, scaled by the passage's overall word coverage. This makes an explicit remembered number useful without letting a lone matching digit outweigh an unrelated topic. A regression test covers this class of miss.

## Final checks

| Check | Result |
| --- | --- |
| Automated tests | 276 pass |
| Existing 2,511-item library, production q8 model | 41/41 development checks, versus 38/41 with only the website owner-ID repair |
| Warm background search over that library | median 19.4 ms; p95 26.8 ms (repair-only baseline 17.2 / 25.8 ms) |
| Cached-model startup | about 0.9 seconds |
| Real-browser same-topic fixture, production q8 | 120/121 intended videos first |
| Stored-vector clean / caption-style regressions | 121/121 and 121/121 |
| Synthetic 30,000 full passages | 190–195 ms; existing budget 400 ms |
| Real-browser TikTok/Reels source/date filters and popup checks | pass |

The 41 local development checks are 40 generated title queries plus the natural numbered-series query found during installed-popup testing. They were used during development and are not a blind evaluation. Personal titles, names, URLs and vectors stay in private local test files and are not committed. This imported library contains titles and visit dates, not transcripts or scenes, so these figures do not establish spoken-moment accuracy in that history. The q8 browser fixture still misses one tire-pressure question.

The popup keeps its 250 ms typing debounce; this is additional to the measured background time. Network downloads are excluded from cached-model startup. No re-ranker, larger model, title-vector duplication, click tracking or new dependency is added.

Dependency audit repeats the existing three high Node-only `sharp` advisories and one moderate Node-only `sprintf-js` advisory. Those modules are absent from the shipped browser bundle; the unchanged Node-toolchain remediation is documented for review by 2026-11-17 in the v3.3.11 notes. The audit is not clean.
