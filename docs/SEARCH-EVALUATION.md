# CueWoven search comparison

This is a historical pre-release evaluation. Its comparative-word fix is included in CueWoven 3.3.36; delivery statements below describe the earlier experiment snapshot.

Tested on this computer in Microsoft Edge 155.0.4283.62 with the actual local quantized MiniLM model. Profiles and libraries were isolated; normal browser history and cookies were not used.

## Kept change

The existing lexical word matcher now connects a bounded set of comparative/superlative forms: old/older/oldest, young/younger/youngest, fast/faster/fastest, slow/slower/slowest, small/smaller/smallest, long/longer/longest, short/shorter/shortest, high/higher/highest, low/lower/lowest, new/newer/newest, and tall/taller/tallest. Existing inflection handling also makes lowered/lowering agree with lower. This improves clue coverage without another embedding pass, a replacement model or modified weights.

Model inputs, embeddings, source text, quoted-phrase bonuses, data schema, capture and privacy rules are unchanged. Existing evidence is matched using runtime lexical caches; no reindexing or model download is required for this change. Reloading the extension loads the new matcher.

## Results

| Evaluation | Before | After |
|---|---:|---:|
| Original baseline, first | 121/121 | 121/121 |
| Specific queries in 1,000-case suite, first | 893/950 | 896/950 |
| Specific queries in 1,000-case suite, within five | 942/950 | 942/950 |
| User-transcript paraphrases, first | 11/16 | 13/16 |
| User-transcript paraphrases, within five | 16/16 | 16/16 |
| Fresh validation queries, first | 115/120 | 115/120 |
| Fresh validation queries, within five | 117/120 | 117/120 |
| Fresh warm-query median | 9.43 ms | 9.30 ms |
| Fresh warm-query 95th percentile | 11.51 ms | 11.24 ms |

There were 0 lost first-place results in the final 1,000-case comparison, and no changed first-place outcomes on the 120 fresh validation cases. Timing differences are within ordinary run-to-run variation; these measurements do not include cold downloads or full popup rendering. No evidence of a two-second latency penalty appeared.

Both original queries (including the misspelling himselve) now rank the supplied video first with competing aging/back-brace/back-pain distractors and no scene evidence. This was also checked through the actual popup. The fixture title is neutral and not verified live YouTube metadata; transcript content is from the user's supplied text. This does not establish why an earlier personal-library search returned nothing.

The first-place gains were:

- the pressurized coffee comes out too fast and tastes sharp
- a video of the speaker calling himselve old and having back pain
- that video of the speaker calling himselve old and having back pain.

## Tests and alternatives

- All 294 Node tests pass, including word-form boundaries, unrelated endings, quote preservation, negation/numbers and opposite-direction words.
- The final 1,000-case engine suite and both exact queries in the real popup pass their regression gates. Remaining retrieval misses are reported rather than asserted away.
- Real MiniLM + CLIP visual fallback passes: relevant text remains first, the timestamp is preserved, text pagination stays stable, visual inference is skipped for relevant text, and real visual fallback still works.
- Main-keyword-only embedding was rejected: known-query first-place results fell from 914/975 to 903/975, with losses in the original baseline.
- Broad prefix cleanup was rejected after a first-place regression. More conservative prefix cleanup plus the word-form fix improved the original suite but fell from 115/120 to 114/120 on new validation cases. It is not in production source.
- Only the small comparative-word fix was retained. Search weights and support scoring were not retuned to these cases.

## Limits

There are 1,120 distinct query cases, not 1,120 independent examples. The original suite has 726 transformed variants of 121 seeds, 108 authored hard paraphrases, 16 user-transcript queries, 100 typo variants, 25 ambiguous queries and 25 absent-topic probes, against 41 videos. The fresh set has 80 authored paraphrases and 40 conversational/typo variants against 61 competing videos (20 additional videos).

The fresh data was frozen before experiments and used to reject prefix cleanup and validate a predefined comparative-only alternative. It is a validation set, not an untouched final holdout. Results are controlled benchmarks, not a general real-user accuracy percentage. A different library, missing transcript or additional distractors can change results.

Ambiguous queries still have multiple reasonable answers. The absent-topic set remains weak at abstention: only 3/25 return no results; 22 return Related suggestions, although none of their first suggestions was labelled Close. Misspellings, negation and several clues across distant passages remain imperfect.

The browser runners write per-query JSON reports to RECALL_REPORT_DIR. See CONTRIBUTING.md for commands.
