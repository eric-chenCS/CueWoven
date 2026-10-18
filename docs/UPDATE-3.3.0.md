# Recall 3.3.0 — responsive search and useful first-run tools

## Search and storage

- Capture additions mark snapshots dirty without rejecting work already running. The next query refreshes them. Delete, Clear, site forget, retention cleanup and backup restore invalidate before and after mutation, including a failed partial restore. A popup request that has not answered in ten seconds shows Retry; late replies cannot replace a newer query.
- Scene saves and watch-date changes update video metadata in the existing index. They do not rebuild the text matrix. OCR, captions and speech still dirty it when their text changes.
- MiniLM inference lives in a dedicated worker. A query passes queued background work at each four-text boundary. Work already executing cannot be preempted, and the first model download still takes time. The worker terminates after five minutes with no work; a later search reloads cached weights. Worker failure/deadline rejects queued callers so retry can create a fresh worker.
- Caption vectors and the resident matrix use scaled 8-bit storage. The matrix retains at most 100,000 caption/title rows, preferring the newest 1,000 full-transcript videos, plus existing bounded OCR rows. Older transcripts are preserved on disk and searched in batches of 500, rather than silently deleted. This bounds resident vectors; text metadata, the browser and model runtimes still use additional memory. Large overflow libraries may search more slowly.
- All imported YouTube titles are kept. Automatic post-import caption fetching queues the newest 200 missing videos. Fetch missing transcripts remains available for an explicit larger job, and the existing parallelism setting remains.
- Schema 6 builds a derived title index in 64 deterministic buckets, about 800 entries each at 50,000 titles. A search reads these bundles and bounded full-content batches instead of deserializing 50,000 individual item records. Canonical items remain for export, mutation and recovery; this adds some disk duplication. Exact lexical matches still participate across the library: the proposed semantic top-300 cutoff was not adopted because it could discard the remembered exact phrase.

## Privacy and controls

- Known private services now include Dropbox, 1Password, Workday, Canvas/Instructure and TurboTax. Messaging, grades, payslips, orders, vaults and related entry routes are checked in the first two path segments, including hash routes. Public article/documentation routes retain topic names such as Email and Health.
- A visible Sign out/Log out control also prevents live page capture. Hidden login controls and ordinary small comment boxes do not by themselves block public text.
- New text redacts recognizable email addresses, formatted phone numbers, formatted SSNs and checksum-valid card numbers. URLs containing matching identifiers are skipped. Images are not redacted. Existing records are not silently rewritten, and these heuristics cannot identify every private page; an allowlist remains the tighter option.
- Google query capture and history import require the separate Save Google search queries switch, off by default. Obvious medical Google queries remain excluded even when it is on. Restoring a user-selected backup still restores its existing records subject to URL validation.
- Light mode gates scenes, on-screen text and speech together without overwriting individual preferences. Captions and article text remain available. Existing saved scene searches can still load CLIP.

## New ways to use Recall

- **Search this video:** an optional current-video scope in the popup, including compatible website videos. Recall tries Index first for a video without a full transcript. All evidence types use the same video filter. It does not fetch an entire uncapturable video or recover portions not played through speech/OCR.
- **Copy link:** each result copies its actual timestamp or article-fragment address. Browser clipboard access can still be denied; the button reports failure.
- **Try sample videos:** optional empty-library button loads five original, silent animated clips and their authored captions. They play locally at the matching time, are labelled Recall samples, and participate in export/deletion. About 2.4 MiB total, with no YouTube fetch or invented association to a real creator. Indexing first needs the usual MiniLM weights.
- **Address-bar search:** type `rc`, then Space/Tab. Suggestions search the local library and open the selected saved source. Titles/snippets are escaped for browser suggestion markup.
- **Capture indicator:** the toolbar dot is green for saved/duplicate content and grey for other capture states; the hover title and popup give the reason. A speech session retains its STT badge. This reflects reported capture status, not a guarantee that every frame or word was saved.
- **Forget recent:** remove whole items saved/updated in the last hour, day or week, including recent imports whose original visit was years ago. Old backups without a save date use their indexing date. The confirmation explains the scope. A suggested Only last week? search chip applies its filter only when clicked.
- Speech controls collapse under a native, keyboard-accessible disclosure so result cards remain visible on video pages.

## Verification on Windows / isolated Chromium

- 223 Node tests pass, including continuous-addition/removal races, metadata-only updates, priority scheduling, worker idle/deadline recovery, popup timeout, bounded 8-bit indexing, private URL examples, redaction and address-bar handlers. Existing generated OCR/cancellation simulations remain included. Reverting the soft query-cache invalidation deliberately fails the new continuous-save regression; the correct code was restored.
- Browser feature checks pass for all five playable sample clips' library entries (one clip's 8-second seek verified), result-copy wiring, current-video scope and initial indexing, ten-second Retry and stale-response rejection, explicit date filtering, Light mode, visible/hidden sign-out behavior, saved-text redaction, the toolbar dot, query opt-in and save-date deletion. The clipboard API is stubbed in that test; it verifies the copied address without changing the real system clipboard. Scope/index setup uses controlled video messages with the real engine.
- Old schema migration preserves text, timestamps and import origin and builds title bundles. Full-content item/byte caps, derived-index deletion, backup restore, scene-query/restore exclusion, OCR cancellation during Delete/Clear and resumed capture pass. A storage fixture needed its asynchronous module import moved before opening its test transaction; that was a fixture error.
- 1,001-video overflow fixture finds the oldest excluded transcript at 64 seconds, exports its unchanged words and removes it after deletion. The old transcript/query vectors are real; the 1,000 newer distractors use zero vectors.
- 205-title import fixture keeps every title and queues exactly the newest 200, retaining imported provenance. The existing batched import test makes zero full-library reads during import and one afterward.
- Real MiniLM, CLIP, English Tesseract and Whisper pass caption, OCR/scene/audio indicators, timestamp links, backup restore and deletion on controlled Instagram/TikTok-origin HTML players. Automatic YouTube speech, Stop, ended/settings cleanup, manual language override and caption/speech write races also pass. This does not establish compatibility with production social-media players or a private Edge profile.

- The extracted ZIP passes the same 223 Node tests and new-feature browser checks. In a fresh profile, three actual public HTTP-200 pages (Wikipedia coral bleaching, Python email documentation and MDN Promise documentation) captured their bodies and returned the correct source for prepared semantic queries and exact saved-body phrases. The Python page can legitimately rank its title above a body passage for the broad query; the body is independently searchable. No user cookies or history were used.

### Measured performance

| Workload | Observation |
| --- | --- |
| 50,000 titles + 600 full 2,000-word pages | 467 ms median / 695 ms p95 new query; 3 ms p95 cached arrow. Existing 1,000/50 ms budgets passed. |
| 24 generated article pages, 120 new/evicted + 120 cached queries | All 120 expected sources ranked first; 8.3/10.2 ms new-query median/p95; 1.8/2.2 ms cached. |
| 12 searches during a full-page reindex | Slowest 317 ms; earlier v3.2.1 recording with the same controlled workload was 2,973 ms. Background work is not instantaneous. |
| 2,000 short stored items | 90 ms first warm-model query, then 2/2 ms cached. |
| 600 full pages / 9,000 body passages | 133 ms first warm-model query, then 2/1 ms cached. |
| Whole isolated browser, 24-article resource run | Peak sampled private committed memory about 622 MiB; 556 MiB after 20 seconds idle; 436 MiB after closing articles and another 10 seconds. Earlier v3.2.1 run: about 628/584/466 MiB. |

The large-library fixture uses real IndexedDB and MiniLM query inference but synthetic zero saved vectors; it measures storage/ranking latency, not semantic accuracy over 50,000 real pages. Model/runtime cold loading is excluded. Resource totals include the browser, tabs and workers and are not extension-only RAM; working-set sums can double-count shared memory. Samples and historical comparisons are not universal latency/memory guarantees or a long-duration leak test. Unit worker cleanup uses a shortened idle interval; the shipping interval is five minutes. The previous combined-video resource run exceeded 2 GiB, so scenes/audio still have a real memory cost.

No model weights, dependencies or host permissions were added. The locked dependency audit on 2026-10-17 still reports three high `sharp` advisories and one moderate `sprintf-js` advisory through `onnxruntime-node`. These are the existing native Node paths excluded from the browser bundle; install scripts remain disabled. No blanket forced dependency upgrade was made. Recheck before the next release and before introducing native processing.

## Updating

Back up before switching folders. Update the same unpacked folder, Reload Recall in the browser extension manager, and refresh video/website tabs. Schema 6 upgrades automatically and cannot be opened by the older schema-5 build. Export before downgrading; keep an older-profile backup if you need a rollback. No history re-import or runtime rebuild is required from v3.2.1. A new folder can create a different extension identity and separate library.
