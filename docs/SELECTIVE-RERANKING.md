# Selective local reranking

CueWoven 3.3.36 uses `cross-encoder/ettin-reranker-32m-v1`, revision `b33e5ceb5110773ea9cf5e00c9bedc83a8c2afdd`, as a second opinion for weak text searches. The existing MiniLM embedder, stored evidence, embedding version and baseline scores remain unchanged. Reload the same unpacked installation to load code changes; published release ZIPs are separate snapshots.

Lite mode skips reranking and releases a loaded reranker when enabled. Captions, article text, existing embeddings and timestamps remain available; difficult searches may rank less accurately.

## Ranking contract

1. Apply the existing date/source/kind/video/exclusion filters and text ranking.
2. Examine up to 20 distinct owners from the first 40 deduplicated results, with up to two passages per owner. Preserve quoted queries. Skip reranking unless the first two owner scores differ by less than 0.04 and none of these owners satisfies the canonical relevant-text rule (`Close` or score at least 0.45).
3. Send the original query, title/channel and up to two retrieved passages for the first ten owners to a local worker. Inputs are capped at 256 query/document tokens per pair; raw text also has size limits.
4. Change order only if the best model score exceeds the runner-up by at least one raw logit. These scores are not calibrated confidence percentages. Original hit objects, text, scores and timestamps are retained.
5. Move only the first 40 result positions. Pagination reuses its retained cached window, including when a model finishes downloading. A newly submitted first-page search may retry a pending model; deleted data invalidates cached results. The existing cache retains three query windows; another first-page submission or eviction can replace a window, so independent callers do not receive separate pagination snapshots.

The established scene/image fallback retains its original fusion order. Reranking runs on text results when visual fallback is not selected or has no available results. Busy indexing/capture work takes priority.

## Loading, limits and privacy

The seven publisher assets total 36,596,448 bytes (approximately 37 MB). Every file uses a pinned revision, exact length and SHA256. Data is cached locally; a corrupt cached file is discarded and downloaded again. No remote JavaScript is loaded and no query or saved content is sent to an inference service. Model requests use fixed URLs without cookies or referrers.

The published quantized encoder and its complete CLS/Dense/GELU/LayerNorm/Dense head are used. The head is evaluated locally from the publisher's unchanged weights; browser score parity is checked against the combined research ONNX graph. The bundled Transformers runtime is reused; no runtime dependency or extension permission was added.

Downloads/loading start only on an eligible weak query and do not block its original results. Loading has a two-minute cleanup deadline. Once ready, an inference request has a 1.8-second deadline; timeout stops the worker and keeps the original results. Failures back off for one minute. A new search cancels obsolete running reranking rather than queuing requests. The worker uses one WASM CPU thread, caches at most eight in-memory prediction vectors, and releases after one idle minute. The persistent cache contains model data, not queries or predictions.

## Tests

Run `node --test tests/*.test.mjs` for policy, scoring-head, cache, lifecycle, cancellation and failure-path checks.

For real Edge tests, set the standard browser-fixture variables from [CONTRIBUTING.md](../CONTRIBUTING.md). Model weights and browser profiles belong in scratch directories, outside Git. Optionally set `RECALL_ETTIN_MODELS` to a local directory containing the seven original publisher files listed in `offscreen/rerank-assets.js`; tests fulfill their fixed download URLs using those files. Otherwise the worker test downloads public pinned model data.

```sh
node tests/browser/rerank-worker.cjs
node tests/browser/search-selective-reranker.cjs
node tests/browser/visual-fallback.cjs
```

The worker runner checks actual WASM inference, numerical control scores, same-length poisoned cache recovery, offline cached loading, invalid requests, corrupt downloads and a forced inference timeout. For additional numerical comparisons, `RECALL_RANK_CASES` and `RECALL_RANK_SCORES` may point to the earlier candidate and Ettin32 research reports.

The search runner executes 1,516 authored cases in phases: 1,000 original cases, 40 literal/contrast/number/channel guards, 120 validation cases, 96 regression cases, 160 new-topic cases and 100 final-confirmation cases. Libraries grow from 41 to 97 videos. Set `RECALL_RANK_BASELINE` to a separate pre-reranker source/runtime snapshot for a paired baseline comparison. It also checks original evidence/timestamps, paging, filters, the actual popup, deletion and clearing. Reports go to `RECALL_REPORT_DIR`.

These are correlated, controlled fixtures, not an accuracy estimate for personal libraries. The two later fixture sets were frozen for the research study and are now regression sets; rerunning them does not make them newly held-out data. Live OCR/speech accuracy, additional languages and large personal libraries need separate evaluation.
