# CueWoven v3.3.24

Search now gives a small bonus to passages that keep neighbouring query words together. Searching "lithium trapped anode" ranks "lithium trapped on the anode" above "trapped heat near the lithium anode", even when both mention every word. Stop words are ignored when forming word pairs, and the bonus (weight 0.1) is smaller than an exact full-phrase match.

The embedding model stays `all-MiniLM-L6-v2`. Six 384-dimension alternatives were measured with CueWoven's own ranking on SciFact, NFCorpus and FiQA (300 queries each, nDCG@10), after calibrating each model's scores to the current scale:

| Model | SciFact | NFCorpus | FiQA | Embedding time vs current |
|---|---|---|---|---|
| all-MiniLM-L6-v2 (kept) | 0.700 | 0.357 | 0.574 | 1.0x |
| bge-small-en-v1.5 | 0.718 | 0.375 | 0.589 | 1.7x |
| gte-small | 0.726 | 0.376 | 0.570 | 1.6x |
| snowflake-arctic-embed-s | 0.699 | 0.361 | 0.577 | 1.5x |
| all-MiniLM-L12-v2 | 0.701 | 0.367 | 0.590 | 1.6x |
| e5-small-v2 | 0.687 | 0.350 | 0.582 | 1.6x |
| multilingual-e5-small | 0.693 | 0.341 | 0.541 | 2.1x |

No model improved all three sets by 0.02 or more. Switching would also re-embed every saved passage and make later indexing about 1.5–2x slower, so the current model remains the better trade for users.

Validation: all 279 Node tests pass, and the new word-pair test fails without the change. CueWoven's 31-query retrieval fixture still finds 30 of 31 (the Japanese query remains the miss). The 30,000-passage ranking benchmark keeps the same result order and takes about 125 ms, up from about 85 ms, within its 400 ms budget. No storage format, permission or dependency changes.
