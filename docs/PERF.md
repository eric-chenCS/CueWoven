# Repeat transcript indexing (v3.3.37 working tree)

Complete unchanged transcripts can reuse their packed vectors after a current `transcriptBatch` provenance marker has been written. Metadata and chunks are read from one readonly transaction. The ordered effective model inputs, row count, embedding version and packed-vector shape must match. History-title, speech and partial records use full inference. Existing unmarked records are processed normally once. Changed inputs retain the original full four-text inference batches; every timestamped passage remains.

An isolated local Edge test with 10,000 saved entries measured three repetitions per workload. An unchanged 240-segment / 239-chunk transcript fell from a median 6,680 ms to 33 ms; the 80-segment case fell from 2,198 ms to 14 ms. Changed transcripts took approximately the same time (7,359 versus 7,501 ms for the long case). All 18 saved-passage/vector hashes and serialized row sizes matched baseline exactly. All 113 complete retrieval result lists matched. These are repeated-save measurements with local model files, not initial-download times or an ordinary-search speedup.

Partial-passage reuse was rejected: changing q8 inference batch composition produced different vectors (minimum cosine 0.9914–0.9942 in controlled comparisons). The final implementation preserves the original composition for every changed transcript. Unit/browser regressions cover batch provenance, moved timestamps, duplicate moments, legacy vectors, restart, capture pause and metadata/vector snapshot races.

There is no additional vector cache or model change. The marker adds about 50 JSON bytes per indexed video (a logical serialization estimate, not physical IndexedDB usage). Existing article deduplication, title indexes, retention and storage caps remain. A native Edge renderer crash recurred in an additional isolated reindex validation; its cause remains unresolved, and no browser-crash fix or RAM reduction is claimed by this optimization.

# Atomic transcript write batching (v3.3.37 working tree)

Transcript replacement/deletion reads at most 500 target keys per batch. Consecutive integer ranges are checked against all primary keys before deletion; a fractional neighbor forces exact-key deletion. The existing write transaction still preserves complete replacement and rollback. Models, ranking, capture settings and storage limits are unchanged.

In isolated local Edge measurements with five repetitions per size, the existing cursor implementation replaced a 2,000-chunk transcript in a median 362 ms. Two runs of the guarded batching implementation took 138 and 158 ms; deletion took 50–64 ms versus 686 ms. A read queued behind the same write waited correspondingly less. These controlled measurements demonstrate reduced write contention, not faster ordinary searches or lower RAM on every device.

Expanding the bounded long-text cache did not improve the 10,000-entry search workload; increasing database read batch sizes made it slower. Both experiments were rejected. Real IndexedDB regression coverage checks neighboring fractional/interleaved keys, batch boundaries, atomic reads, metadata preservation, rollback and string-key media isolation.

# Current model residency

The text, speech, visual and reranker workers use one shared loader to pass the packaged ONNX WASM file as bytes, avoiding the streaming-compilation path implicated in the retained Edge startup crash. Each worker fetches it once during successful runtime initialization; CLIP reuses that initialized runtime across its text and image encoders. The loader clears the explicit `wasmBinary` configuration after initialization succeeds or fails; the runtime can still retain internal copies. OCR uses Tesseract and is unchanged.

In eight alternating fresh Edge 155 profiles (four per loader), the original/byte-loader median startup times were 496/483 ms, warm 113-query batch times were 814/808 ms, and individual inference medians were 5.8/5.9 ms. All 43,392 vector components matched bit-for-bit. Median sampled peak private memory across the isolated browser's processes increased from 727 to 768 MiB. These local-model measurements are not extension-only allocations, first-download timings, a universal RAM limit or evidence that the rare crash is fixed. The text-worker restart window uses monotonic elapsed time so system-clock changes cannot bypass or prolong its cooldown.

A separate twelve-profile comparison used streaming/bytes/bytes/streaming order for each additional model. Median startup changed from 772 to 812 ms for Whisper, 942 to 994 ms for CLIP's text encoder, and 1,169 to 1,149 ms for Ettin. CLIP's subsequent image-encoder initialization was 1,181/982 ms. Median sampled peak aggregate private memory increased by approximately 19 MiB (speech), 87 MiB (vision with both encoders) and 53 MiB (reranking). All six tested speech clips retained identical transcripts/timestamps, all twelve CLIP vectors matched bit-for-bit, and all six reranker score arrays matched exactly in every run. Two runs per path per model are diagnostic observations, not statistically established speed improvements, universal accuracy measurements or fixed RAM overheads. No new native crash occurred; a reduction in rare-crash frequency remains unproven.

Popup open warms the text search model and index, but does not preload CLIP just because the library contains saved scenes. Actual scene/image capture and visual-fallback queries still load CLIP when needed. Text search retains its worker during active use and releases it after 60 idle seconds, rather than five minutes. Queued processing and stored vectors are preserved. Vision, OCR and the selective reranker retain their existing 60-second idle windows; speech still loads only for fallback transcription and releases when its session ends.

Paired isolated Edge measurements on the test i9 laptop found first visual searches with local model files took about 0.57–0.59 seconds with on-demand loading, versus about 0.024–0.025 seconds after eager visual preload. A final-code browser check returned a completed first visual result in 0.61 seconds and reloaded a text worker for a fresh query in 0.22 seconds. Opening a popup for text-only work avoids the visual warmup's processing and transient memory spike. A one-minute idle comparison sampled about 158 MiB less total browser working set with earlier text release. These are whole-browser endpoint measurements on controlled fixtures, not precise extension allocations, universal limits or first-download times.

The optional visual-search response budget remains 1.2 seconds, and ready reranking remains bounded to 1.8 seconds. On a slower device or during initial downloads, optional images may still be pending and require submitting the search again; the budgets do not guarantee completed visual results in two seconds on every laptop. Cached-model browser acceptance requires a completed first visual response within two seconds on the measured setup.

An experiment shortening OCR idle retention to 15 seconds was rejected: memory improvements were inconsistent and OCR reload work increased. Keeping it warm avoids repeatedly paying that cost. No capture settings, model weights, inference precision, ranking or saved-content limits were changed by this residency update.

## Additional residency experiments

Three sequential isolated Edge runs per strategy exercised the same MiniLM, CLIP and OCR inputs on the test i9 laptop. OCR frequency, models and precision were unchanged. The visual workload was explicitly enabled; it does not represent the new default with visual capture Off. All tested embeddings, OCR outputs, similarity scores and expected text rankings matched exactly. These direct-module experiments did not include speech, the reranker, application cancellation or sustained multi-tab capture.

| Experimental policy | Index workload, median | Browser working set after 18 idle seconds, median | Text query after idle, median / maximum | Verdict |
| --- | --- | --- | --- | --- |
| Current 60-second residency | 934 ms | 1,679 MiB | 6 / 6 ms | Reference |
| Queue inference but keep workers | 1,108 ms | 1,474 MiB | 6 / 7 ms | Memory change overlaps baseline variation; not adopted |
| Queue and release workers after every operation | 1,587 ms | 765 MiB | 273 / 275 ms | Repeated reload cost; prototype only |
| Release all three workers after 15 idle seconds | 796 ms | 729 MiB | 276 / 1,248 ms | Promising idle reduction; needs separate model attribution and application load tests |
| Skip initial text warmup | 897 ms | 1,404 MiB | 6 / 33 ms | Avoids unused preparation, but retains models after actual use; prototype only |

Working sets sum browser processes and can count shared pages repeatedly. These are stage-boundary samples, not true peaks, exclusive extension memory or ordinary-use averages. Baseline idle samples ranged from 1,247 to 1,739 MiB. CPU snapshots omit terminated-process history, so no CPU-time savings are claimed. Lower index time in a short-idle run does not establish that idle expiry speeds up indexing.

A separate six-cycle trial used the vague query about a speaker getting old and having back pain. Preparing text before typing took 333–445 ms, followed by a 52–83 ms query. Deferring preparation until the query took 385–489 ms, with identical vectors. Loading work moves to the query rather than disappearing. None of these additional policies is enabled in the application; the existing 60-second timers remain.

# Historical demo responsiveness and restore (v2.11)

Popup open preloads CLIP text inference only when saved scene records exist, alongside text warmup. Inference still releases after 60 seconds idle; reopening begins loading sooner rather than keeping every model alive indefinitely. Warmup is coalesced, real queued searches take priority, and frame/restore image work waits for pending warmup. Unit/browser checks verify routing and worker reuse; no quantified real-device latency improvement is claimed.

The settings restore path sends one video or one image per background request instead of a complete library. The actual file-input browser regression verifies request sizes and preserved scene search. A 53-video unit regression checks ordering/progress/failure durability. This bounds request scope, not individual transcript size or total restore time. Unchanged models, runtime bundle and media/storage caps apply.

# Retrieval accuracy and migration (v2.10)

Saved text vectors now use the spoken passage; title/channel context is scored separately. Legacy upgrades process 16 chunks per model batch, yield between batches, and update only vectors after checking current chunk identity. Parent existence is read once per video within each write transaction. Search stays available and cache reads coalesce; revision checks discard builds invalidated during asynchronous reads. Upgrading a large library still requires CPU time and can temporarily mix old/new vector recipes. No lower CPU or RAM claim is made.

MiniLM and BGE-small both returned all 31 labeled synthetic first moments. Their single initialization-plus-batch runs took 2,395 and 3,017 ms respectively, including cache/download conditions, so they are not inference-only benchmarks. Whisper tiny.en took 1,464–1,710 ms for the generated speech variants; base.en took 2,694–2,802 ms, with zero normalized word errors for both. These measurements support keeping the lighter existing models on this narrow fixture; they do not establish universal model accuracy or speed. The runtime bundle, dependencies and media caps are unchanged.

# Scene sampling and unified search (v2.9)

Frames are encoded at no more than 320 × 180, at most once per 20 wall seconds and per playback bucket, only from a visible playing video. The live saved JPEG data URL was 11,323 characters; the hard input limit is 90,000 characters. Caps are 120 snapshots per video and 1,000 total. These caps bound frame storage rather than claiming every video fits a fixed byte size. Search reads scene metadata/vectors through a cursor and loads image data only for final displayed matches. One inference runs at a time, with at most the newest text query waiting; new frames skip a busy worker. The visual worker expires after 60 seconds idle.

The real CLIP model test took 3,678 ms to initialize/embed a public image. The existing bundle grew from 868,255 to 868,380 bytes when exposing the model classes; additional weights download separately. This is a single-run diagnostic and package-size measurement, not a CPU, memory or throughput improvement. Visual work adds cost, especially alongside speech recognition. Both models indexed one live public YouTube session successfully; the user can disable snapshots if the extra load is undesirable. The storage-cap and bounded-worker tests guard resource growth.

# Automatic speech fallback (v2.8)

Recognition runs in a separate worker using quantized Whisper tiny.en on one WASM thread. The audio worklet emits one second of 16 kHz mono PCM per message, with no video frames sent to the extension. Recognition uses 15-second windows, one inference at a time, at most two queued windows plus the in-flight window. Silence is skipped. Backlog stops capture instead of growing indefinitely, and the worker is released after stopping. Speech model progress notifications are coalesced to percentage changes. Background history capture tabs never load the speech model.

In one isolated model check, a 14.14-second generated speech fixture took 3,286 ms to prepare and 1,758 ms to recognize. These single-run timings are diagnostic evidence, not a device-wide speed or RAM claim. Actual player-audio capture, recognition, embedding and search passed both the controlled end-to-end test and one live public YouTube video. English recognition is imperfect and coverage begins after caption failure/model preparation, not at the start of the video. First downloads and sustained recognition add network/CPU cost; the existing search and import regressions pass with this feature enabled.

# Minimized capture window (v2.7)

Request-only capture from v2.6 is removed. Six full YouTube players run in one separate minimized window (or three for lower load). This isolates the main tab bar and restores player/session capture; it does not claim lower per-player memory/CPU or bypass YouTube restrictions. The headed Windows regression completed eight controlled videos with six concurrent players while preserving main-window focus; normal completion, pause and manual closure cleaned up the owned window. Coalesced library refresh remains: 30 completion events produce one refresh.

A create-about:blank-then-navigate approach repeatedly stalled the last controlled navigation. Opening the player URL directly eliminated that reproduced stall. Adding tabs can restore a Chromium window, so Recall reapplies minimized state without issuing a focus command. Issuing focused:false again while minimizing changed the main-window focus in a headed test; using a state-only update passed. These are browser behavior checks, not a throughput or RAM benchmark.

# Transcript-import performance experiments (v2.6)

| Change | Measurement | Result |
| --- | --- | --- |
| Replace full YouTube tabs with direct requests in default mode | Equivalent 12-way controlled caption jobs: v2.5 created 12 concurrent player pages; v2.6 created zero YouTube tabs and completed 14 videos | Kept: removes full-page rendering, playback and page scripts from the request path. No real-device RAM/CPU percentage or live throughput claim. |
| Limit opt-in fallback | Selected parallel value 12: old maximum 12 full pages; new maximum 2, tested through real capture pipeline | Kept: explicit compatibility choice with lower page load. |
| Coalesce completion notifications | 30 index-changed events: 30 immediate list reads/rebuilds before; 1 delayed refresh after | Kept: production browser regression checks one refresh and final saved data. |
| Serialize inference with priority and batches of 4 | Same isolated real-model test, 4 videos × 150 segments (75 chunks each), warm model, seeded search: existing 5,377 ms total / 33 ms search; candidate 5,693 ms / 233 ms | Reverted: slower in this measurement; existing model path retained. These single-run timings diagnose the rejected change, not a speed benchmark. |

Tests use synthetic captions and isolated profiles. YouTube can return empty signed captions or block requests, so fewer tabs does not promise faster or universally successful caption retrieval. No hidden iframe ships: a live embedded-player probe returned a configuration error.
