# Recall 2.3.0 — one video at a time by default

Recall now opens in **One video at a time** view. Search shows the strongest matching video with its best available transcript moment. **→** moves to the next distinct video; **←** goes back. The first match disables Previous and the last eligible match disables Next closest. A title-only entry still opens without a timestamp.

Navigation ranks the full saved library and is not limited to the list view's first 12 results. Date filters and the existing minimum similarity threshold still apply. Match scores indicate similarity, not a calibrated probability that a video is the intended source.

Starting a new query, editing refinement clues, changing date filters or switching views resets to the strongest eligible match. Navigation is disabled while a page is loading, and delayed pages cannot overwrite a newer search. If the library changes and the current position no longer exists, Recall returns to the first match.

Uncheck **One video at a time** to use the existing list view. Your view choice is remembered in this browser profile. Results per video applies to that list; the single view always uses one best moment per video. Reopening the popup starts at the first match of its restored main query.

All 40 Node tests pass. The new optional tests/browser/single-video.cjs browser regression checks 14 distinct matches with the real local model and ranker, including an imported title. It verifies navigation beyond the first 12, exact links, boundaries, resets, stale pages and saved list preference. The refinement browser regression also passes. Transcript data is controlled; live YouTube capture was unchanged and not retested.

Reload Recall and reopen its popup to use v2.3. No dependency or permission was added. The previously built vendor runtime still works; rebuilding it is not required for this update.
