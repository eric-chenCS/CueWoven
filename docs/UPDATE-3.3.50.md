# CueWoven 3.3.50 beta

Text-model initialization now passes the bundled ONNX WebAssembly file as bytes, avoiding the streaming-compilation path implicated in a retained Edge startup crash. Missing or corrupt runtime files return errors and a fresh worker can retry. The explicit loader configuration is cleared after initialization succeeds or fails; the runtime may retain internal copies.

The text-worker restart cooldown now uses monotonic elapsed time. Changing the system clock cannot bypass the restart budget or extend it. Normal healthy-worker reuse and the one-minute idle timeout are unchanged.

Eight paired fresh-profile Edge runs produced identical embeddings for 113 queries (43,392 float components). Median startup was 496 ms with streaming and 483 ms with bytes; individual inference was 5.8/5.9 ms. Median sampled peak private memory across the isolated browser increased approximately 41 MiB. These local-model measurements are not universal timings, extension-only RAM figures or proof that the rare crash is fixed. Actual offline searches over the same sample library returned identical item order, timestamps and match labels for 118 queries.

Validation: 388 unit tests and all 16 maintained isolated Edge programs pass. New regressions cover system-clock jumps, non-streaming initialization, missing/corrupt runtime files and recovery. Mutation tests detect restoring the wall clock or removing the explicit WASM configuration. Exact release packages are separately checked for complete runtime files, fresh model download, offline search, backup/restore and capture cancellation.

Only text-model startup changes. Speech, visual, OCR and reranker loading, model weights, precision, batching, ranking, stored data, dependencies and permissions are unchanged. The two earlier native Edge/V8 failures remain unexplained; this is a tested precaution, not guaranteed crash prevention. Second-computer validation remains pending. Only the install ZIP is published; the store ZIP stays local.
