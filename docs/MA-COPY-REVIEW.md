# ma-copy review and adaptation

Reviewed commit [55e4f8c](https://github.com/eric-chenCS/SwampHacks-XII/commit/55e4f8ca06b5b19c9c33d58b13f3009211f0821b), attributed to Marcos Perez, against main at 5fd3752 (v2.9). The patch is based on v2.1, so merging it unchanged would omit later search/navigation, audio and scene behavior. Its original 37 tests pass, but it adds no tests for the new ranking or migration.

## Findings, most important first

1. **Required: migration can overwrite newer data.** [The replacement at offscreen.js:115](https://github.com/eric-chenCS/SwampHacks-XII/blob/55e4f8ca06b5b19c9c33d58b13f3009211f0821b/offscreen/offscreen.js#L115) writes a video snapshot after asynchronous embedding. A deletion, rewatch or caption replacement during inference can be undone. Its reconstructed chunks also omit later audio-range metadata. Adaptation: update vectors only, in a transaction, after checking current chunk identity/text/start and parent existence. No video metadata is replaced.
2. **Required: weak literal matches can outrank better semantic answers.** [search.js:80](https://github.com/eric-chenCS/SwampHacks-XII/blob/55e4f8ca06b5b19c9c33d58b13f3009211f0821b/lib/search.js#L80) admits any positive lexical score into a second ranked list. Equal reciprocal-rank contributions can reward a weak one-word decoy. A reproduced battery query selected a lunch-box passage over a stronger lithium explanation. Adaptation: keep semantic strength, with bounded body-word/phrase evidence and modest separate title/channel context. Explicit quoted speech gets stronger priority.
3. **Required: transcript presence overrides relevance.** [search.js:95](https://github.com/eric-chenCS/SwampHacks-XII/blob/55e4f8ca06b5b19c9c33d58b13f3009211f0821b/lib/search.js#L95) puts all transcript hits before imported titles. A near-exact imported Roman-concrete title lost to an unrelated transcript. Adaptation: rank relevance across both sources; preserve source indicators.
4. **Required: migration blocks first search; cache invalidation can be lost.** [offscreen.js:135](https://github.com/eric-chenCS/SwampHacks-XII/blob/55e4f8ca06b5b19c9c33d58b13f3009211f0821b/offscreen/offscreen.js#L135) waits for the entire migration. The asynchronous cache build can then publish a stale snapshot after invalidation. Adaptation: 16-chunk background batches with progress, per-chunk versions, coalesced reads and revision checks. Search remains available while older vectors are improved.
5. **Required for integration: retain current interfaces.** The older ranker has no offset handling or partial-audio result marker. Copying it over main would break current arrow pagination and audio attribution. Adaptation retains both, scene fusion, date filters and per-video limits.

Useful ideas retained: spoken-text-only embeddings, explicit embedding versions, phrase/word matching, coalesced builds, and removal of misleading match percentages. The teammate branch is unchanged; the adaptation is in main v2.10.

## Controlled comparison

Fifteen synthetic videos and 31 labeled queries were fixed before implementation. Tests use real q8 model vectors, include paraphrases, misleading titles, exact speech, Unicode and imported titles, and evaluate the first video and exact labeled timestamp.

| Configuration | Correct first video | Correct first moment |
| --- | ---: | ---: |
| Main v2.9 MiniLM, title-prefixed passages | 30/31 | 29/31 |
| Unmodified ma-copy, body-only MiniLM | 29/31 | 29/31 |
| Previous ranker, body-only MiniLM | 31/31 | 31/31 |
| Adapted v2.10, body-only MiniLM | 31/31 | 31/31 |
| Adapted v2.10, BGE-small comparison | 31/31 | 31/31 |

Most of this fixture's improvement comes from separating passage embeddings from titles. Additional phrase/Unicode protections have separate regression tests; these figures do not isolate their real-world impact. BGE used CLS pooling and its recommended retrieval-query prefix. Because it tied MiniLM here, the release keeps MiniLM rather than claiming a larger model is more accurate. See RETRIEVAL-EVAL-2.10.json and tests/browser/retrieval-eval.cjs. The comparison script requires a Git checkout containing the two pinned commits, plus Playwright/browser configuration. Cached vectors are optional and must match the fixture hash.

Whisper tiny.en and base.en both achieved zero word errors on one generated English passage in clean, added-noise and 1.25x-speed variants. Base took longer in this isolated run; tiny remains shipped. This narrow single-voice check does not measure real-world recognition accuracy. See SPEECH-EVAL-2.10.json and tests/browser/speech-eval.cjs. CLIP scene matching remains enabled in ordinary search; raw CLIP and text-vector scores are never compared as shared probabilities.

These examples are regression evidence, not a representative held-out YouTube benchmark. Audio covers played portions, scenes are periodic samples, and semantic results can still be wrong. Improving models further needs a broader labeled dataset with accents, music/noise, ambiguous memories and real visual actions.
