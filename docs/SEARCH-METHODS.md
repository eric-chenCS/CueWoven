# CueWoven reranker and rewriting study

This is the historical MiniLM/FLAN research report. The newer local implementation uses [selective Ettin 32M q8](SELECTIVE-RERANKING.md); delivery statements below describe the earlier experiment snapshot.

## Main finding

A conditional local reranker is promising. The conservative candidate improved known-query first place from 1063/1135 to 1074/1135, with 11 corrected results and no displaced correct results in this controlled comparison. The separate 96-case confirmation improved from 92 to 93 first-place results, again without a loss. These are modest, measured gains, not a real-user accuracy guarantee.

It ran on 49/1160 queries (4.2%). Most requests retain the existing search cost. For requests that actually invoke the extra model, measured model inference was 314 ms median and 514 ms at the 95th percentile. The additional model data totals 23.9 MB. Downloads and initial model loading are separate costs.

The normal extension has not been switched to this method. This study adds optional research tests and documentation; earlier local application fixes remain in place. No commit, push, release, replacement ZIP, new production dependency or store upload was made.

## What was tested

Real Microsoft Edge 155.0.4283.62 on this computer, isolated extension profiles, actual current MiniLM embeddings and WASM inference on one CPU thread. No normal browser history/cookies were used. Model data was downloaded from pinned Hugging Face revisions and hash verified. Queries and transcripts were not sent to hosted inference.

There were 1,256 distinct query cases: the existing 1,000-case suite, 40 additional quote/contrast/number/channel guard cases, 120 existing validation cases, and a final 96-case confirmation set. Some cases are correlated variations, not independent examples. The first 1,040 cases ran against 41 competing videos; the 120-case validation and 96-case confirmation used 61 videos. A separate rewrite pilot and broader rewrite validation reused subsets of those cases.

The first sweep compared 12 fixed policies. Four related/weak gates were added after reviewing that sweep, reusing existing relevance signals, then frozen before the final 96-case confirmation. The full-sweep results for those additional gates are therefore post-hoc. The weak gate was verified by rerunning all 1,160 original retrievals and checking all 20 candidates, with exactly reproduced baseline candidates. No rule was changed after confirmation.

## Retrieval-policy comparison

The accuracy columns below count 1,135 cases with an expected answer; 25 absent-topic probes are tracked separately. Gains/losses count changes over all 1,160 cases, including absent-topic probes. The median/95th-percentile times project each policy from measured baseline, extra-query and inference stages. Caches and repeated variants apply; these are not production end-to-end guarantees.

| Policy | Correct first / 1135 | Gains | Losses | Median ms | 95th ms |
|---|---:|---:|---:|---:|---:|
| Current search | 1063 | 0 | 0 | 10.0 | 12.4 |
| Conservative prefix rewrite | 1068 | 7 | 2 | 10.3 | 20.9 |
| Original + prefix rewrite fusion | 1063 | 0 | 0 | 10.3 | 20.9 |
| Original + content-word search fusion | 1058 | 4 | 10 | 17.6 | 21.5 |
| Original + separate-clue searches | 1058 | 2 | 7 | 10.1 | 24.4 |
| BM25 + semantic rank fusion | 1027 | 9 | 45 | 10.1 | 12.6 |
| Additional cross-passage clue coverage | 1068 | 7 | 2 | 10.1 | 12.6 |
| Rerank every top-10 shortlist | 1086 | 40 | 17 | 299.7 | 529.4 |
| Original + reranker rank fusion | 1072 | 12 | 3 | 299.7 | 529.4 |
| Rerank near ties | 1080 | 21 | 4 | 10.1 | 196.1 |
| Near ties + reranker margin | 1077 | 16 | 2 | 10.1 | 196.1 |
| Rewrite/reranker agreement check | 1063 | 0 | 0 | 10.1 | 197.7 |
| Related near ties only | 1080 | 21 | 4 | 10.1 | 165.6 |
| Related near ties + margin | 1077 | 16 | 2 | 10.1 | 165.6 |
| Weak near ties only | 1076 | 15 | 2 | 10.1 | 16.1 |
| Weak near ties + margin (best conservative candidate) | 1074 | 11 | 0 | 10.1 | 16.1 |

## Candidate rule

1. Retrieve with the existing model and scoring.
2. Preserve literal quoted searches.
3. Ask for a second opinion only when the best two scores differ by less than the existing 0.04 near-tie boundary, and none of the 20 retrieved candidates qualifies as relevant text under the existing `hasRelevantText` rule (Close, or score at least 0.45).
4. Locally rerank the first ten videos using up to two saved passages per video, title and channel, capped at 256 query/document tokens.
5. Change order only if the reranker winner exceeds the runner-up by at least one raw logit. Otherwise keep the original ranking.

The reranker is [Xenova/ms-marco-MiniLM-L-6-v2](https://huggingface.co/Xenova/ms-marco-MiniLM-L-6-v2), revision `a09144355adeed5f58c8ed011d209bf8ee5a1fec`, quantized. Its standard Berlin-versus-New-York sanity check matched the documented result. Raw logits and margins are ranking signals, not calibrated confidence percentages.

This rule helps ambiguous weak matches while preserving existing strong text results. The measured absence of regressions is limited to these cases; it is not proof that future queries cannot regress. The full cross-encoder frequently ranks better but can also confidently prefer the wrong video, as seen in the coffee and rice distractor cases.

## Confirmation

The 96 cases were written after choosing candidate policies and before evaluating the new cases. They include 48 authored paraphrases and 48 typo/conversational variants. Labels and thresholds were unchanged after evaluation.

| Policy | Correct first / 96 | Within five | Gains | Losses | Median ms | 95th ms |
|---|---:|---:|---:|---:|---:|---:|
| Current search | 92 | 96 | 0 | 0 | 11.3 | 13.5 |
| Rerank every query | 94 | 96 | 4 | 2 | 372.6 | 559.6 |
| Related near ties + margin | 95 | 96 | 3 | 0 | 11.4 | 29.1 |
| Weak near ties + margin | 93 | 96 | 1 | 0 | 11.4 | 14.7 |

The public classification-pipeline implementation reproduced the confirmation result after the initial model-class experiment. No production runtime export patch is needed by the saved runners.

## Sentence rewriting and double checks

Two deterministic FLAN-T5-small prompts were screened on 48 challenging cases. With quote/number/channel guards, the search-query prompt fell from 40 correct first results to 34. The paraphrase prompt reached 41, with three gains and two losses. Fusing either rewrite with the original scored 39. These mixed results justified a broader check rather than deployment.

The paraphrase prompt was then checked on 176 cases: 120 validation queries, 40 guards, and 16 user-transcript queries. It was also tested with a second MiniLM comparison of the original/rewrite meaning (cosine at least 0.75), negative-query fallback, rank fusion, and ambiguity gating.

| Approach | Correct first / 176 | Gains | Losses | Median ms | 95th ms |
|---|---:|---:|---:|---:|---:|
| Current search | 159 | 0 | 0 | 9.8 | 12.8 |
| Raw local paraphrase | 142 | 4 | 21 | 132.5 | 221.4 |
| Quote/name/number guards | 145 | 3 | 17 | 132.5 | 221.4 |
| Original + guarded paraphrase fusion | 153 | 1 | 7 | 132.5 | 221.4 |
| Semantic double check | 156 | 0 | 3 | 131.6 | 225.5 |
| Double check + rank fusion | 158 | 0 | 1 | 131.6 | 225.5 |
| Ambiguity-gated double check | 158 | 0 | 1 | 9.8 | 148.3 |
| Ambiguity-gated double check + fusion | 159 | 0 | 0 | 9.8 | 148.3 |

The tested rewriter is [Xenova/flan-t5-small](https://huggingface.co/Xenova/flan-t5-small), revision `311454e83bc784267fd7eef5940ee854144abbec`. It is not a task-specific query rewriter. This particular browser/model combination failed a basic capital-of-France control; full-precision weights did not fix that control. Treat this as a rejected local configuration, not a definitive judgment on all generative rewriting models.

Examples illustrate why retrieval scores alone are insufficient. A search rewrite became “a syringe,” which the length guard rejected. Another became “a syncing game” and happened to retrieve the right gaming video even though it changed the remembered meaning. The paraphrase prompt sometimes emitted only spaces. A high semantic similarity or a lucky retrieval hit does not establish faithfulness.

Quantized rewriter assets total about 97.5 MB. Full-precision model weights alone total about 374 MB and were tested only for six identical controls/queries, not the full accuracy suite. They were not enabled in the app.

## Limits and remaining work

- Controlled, partly correlated fixtures do not estimate accuracy on personal libraries. Additional distractors, unavailable transcripts, other languages and larger libraries can change outcomes.
- The existing misspelling, negation, numeric and source handling remain imperfect. The extra guard set exposed weaknesses that heavier models did not consistently solve.
- The absent-topic set still produces Related suggestions for many missing subjects. A reranker is not proof that a requested video was saved.
- Reranking selected owners using two joined passages was evaluated for video retrieval; it has not established better timestamp selection.
- Timing reflects this computer, one-thread WASM and warmed inference stages. First-install downloads, cold loading, slower hardware, concurrent OCR/speech, queue cancellation and production fallback behavior need separate integration work.
- The promising candidate still needs a bounded worker, nonblocking first download/load, deadline and original-result fallback, stale-query cancellation, cache invalidation, and integration with text-first visual fallback before it should become a default. This task tested methods; it did not add that production feature.

## Reproduce

The optional runners are in `tests/browser/`: `search-methods.cjs`, `search-rewriter-validation.cjs`, `search-reranker-confirm.cjs`, and `rewriter-precision.cjs`. Use `download-search-method-models.py <model-directory>` for pinned quantized assets, optionally `--fp32` for the precision control.

Set `RECALL_PLAYWRIGHT`, `RECALL_BROWSER`, `RECALL_TEST_ROOT`, `RECALL_MODEL_DIR` (existing MiniLM/CLIP data), `RECALL_METHOD_MODELS` (extra downloaded model data) and `RECALL_REPORT_DIR`. No generated models, private profiles or runtime bundles belong in Git or store ZIPs.

Raw reports: `cuewoven-search-methods.json`, `cuewoven-reranker-confirmation.json`, `cuewoven-rewriter-pilot.json`, `cuewoven-rewriter-validation.json`, `cuewoven-rewriter-precision.json`, `cuewoven-method-models.json`.
