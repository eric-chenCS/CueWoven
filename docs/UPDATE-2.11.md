# Recall v2.11 — demo fixes

The supplied reports were checked against v2.10. The main six issues reproduced in focused tests or followed directly from the active code paths. Fixes preserve ordinary unified search and the default single-video arrows.

| Finding | Change |
| --- | --- |
| A 0.23 scene displaces a 0.40 transcript | Raise the CLIP scene cutoff from 0.22 to 0.26, enforcing it in scene retrieval and fusion. Rejected scenes no longer enter reciprocal-rank fusion. Text-only fallback always carries a Transcript/Audio/Title indicator. |
| Speech indexes music tags/filler or known non-English audio | Remove recognized non-speech tags and a small list of standalone stock filler phrases before chunking/saving. Preserve those words inside longer sentences. Original audio language metadata, then ASR caption language, take precedence over translated captions; known non-English audio skips the English-only fallback. Both bridge and background guard it. |
| Scene-only videos never expire | Mark imported titles explicitly. Live watch/scene capture clears the import exemption. Watched title-only entries expire alongside transcripts; origin survives backup restore. Legacy title records with scenes expire; ambiguous legacy titles without scenes keep the exemption to preserve old imports. |
| A → home → A is ignored | Clear the main announcement state and bridge video/dwell/scene state on non-video navigation. Returning to A restarts capture and updates recency. |
| Enter only searches in the default view | Enter opens the displayed current match. After edits or while a search is pending, it gets the fresh match first and rejects stale responses. Ctrl/Cmd+Enter opens in the background. List selection and refinement submission retain their behavior. |
| Cold scene search waits for model reload | Opening a popup with saved scenes preloads CLIP text inference alongside text-search warmup. Requests coalesce, real queries take priority over queued warmup, and image work waits for warmup rather than failing busy. The idle release still limits resource use. |

Also split settings-page backup restore into one-video or one-image requests, with progress and durable partial completion. Keep the page open; earlier completed items survive interruption. Each video is still re-embedded for model compatibility, and a single unusually large video can still be expensive. This reduces whole-library request duration; it is not a universal five-minute-limit guarantee or a measured large-corpus speedup.

Removed the unused bulk-index handler and its obsolete broadcast subscription after checking all callers. The active background transcript queue remains. Takeout strips additional Spanish, French, Italian, Portuguese and German action prefixes; unrecognized locale formats remain intact. Release history, evaluation JSON and technical reports now live in docs/; README, INSTALL and CONTRIBUTING stay at the root. Packaging and links were updated.

No dependency, model or permission change. Reload the existing extension and refresh YouTube tabs; version should read 2.11.0. No re-import is required. Newly saved speech is filtered; existing speech text is not destructively rewritten.

The scene cutoff is a heuristic, not a calibrated confidence level, and can miss weaker useful scenes. Unknown audio language still uses the English model; metadata is not acoustic language detection. Stock filler filtering can omit a genuine standalone “Thank you.” and cannot eliminate all hallucinations. Popup warmup can overlap typing and still needs initial model downloads/CPU; no measured latency reduction is claimed. See [the test report](TEST-REPORT.md) for verification and existing dependency findings.
