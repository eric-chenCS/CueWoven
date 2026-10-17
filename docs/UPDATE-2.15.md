# Recall v2.15 — adaptive scene snapshots

Version **2.15.0** keeps extra frames around noticeable visual changes and saves fewer routine frames during quiet footage. Scene evidence joins the existing combined search. Caption, audio and on-screen-text sampling behavior is unchanged.

## Capture behavior

- After the existing watch delay (at least three seconds for scenes), a 96 × 54 pixel probe checks visible playing video every half second. RGB differences ignore small pixel noise. Broad changes or a strongly changed local region can trigger an extra 320 × 180 JPEG. This is a visual-change heuristic, not semantic event detection.
- Routine snapshots check for changes against the last routine frame at approximately 20-second checkpoints. Nearly unchanged footage can wait up to 60 seconds between routine attempts. Pauses, hidden players, ads, seeks, already-sampled video buckets and busy processing can extend the interval. A new noticeable change can trigger an extra frame during that quiet interval.
- Each player has one in-flight request and one waiting JPEG. The first waiting event is retained even if the picture immediately changes back. Requests are at least two seconds apart; waiting images expire after 10 seconds. Playback revisions and navigation discard stale queued events. The service worker verifies active visible playback, video identity, revision and capture age before forwarding a frame.
- A shared engine budget permits six extra inference attempts per rolling minute across Recall, including separate visible windows. Regular snapshots remain eligible when that budget is exhausted. Existing offscreen serialization prevents simultaneous scene/OCR/query inference. Busy frames can be retried within the short waiting window; there is no growing queue. Model/download errors back off for 20 seconds instead of retrying on every probe.
- Extra frames use separate half-second keys, so multiple moments inside the same 20-second routine bucket survive. Existing keys and database schema remain valid. Backups preserve the extra-frame flag and timestamp, including after restore.

The existing limits remain **240 snapshots per video, 2,000 total and a 24 MiB compressed-image/vector budget**, with oldest-first eviction. Faster capture of active footage can reach them sooner. Probe buffers retain at most about 81 KiB per active player, plus reusable canvases and at most two small JPEG requests; this excludes browser video decoding and model memory. Disabling capture releases the reusable canvases and queued buffers. No new dependencies, permissions, model weights or IndexedDB schema version changes.

## Validation

All **168 Node tests** pass. New regressions cover quiet 60-second sampling, noise suppression, visual changes after a quiet stretch, short events between routine frames, probing while inference is running, bounded waiting frames, busy retry/expiry, six-extra budgeting, navigation/disable/seek cleanup, independent storage keys and service-worker source validation. Temporarily making visual-change detection always return false caused the relevant tests to fail; the real implementation was restored.

The isolated Chromium adaptive regression uses actual canvas-stream video playback, extension content scripts, the service worker, IndexedDB, CLIP and MiniLM. A brief cat image appeared at about 7.7 seconds and was saved at about 8.1 seconds; search returned that saved scene timestamp. Returning to the original picture saved a distinct extra frame in the same routine bucket. Continuing static playback past 25 seconds produced no second routine frame. Six extra attempts shared across three video IDs exhausted the engine budget; the next extra was refused while a routine frame succeeded. Backup restore retained all extra frames and flags.

The existing real-model scene, capture-hold, OCR and import-integrity browser regressions are also run for this release. They cover scene/transcript search, legacy database migration, arrows and previews, storage caps/retention, scene restore during search, conflicting mutations, OCR cancellation during Delete/Clear and subsequent capture recovery, burned-in text search, file-input backup restore and imported-history protection.

Two 200-sample static-canvas runs measured the old 320 × 180 JPEG snapshot step at **0.7–0.8 ms median / 1.0–1.2 ms p95** and the new tiny probe plus comparison at **0.4–0.5 ms median / 0.6–0.7 ms p95** on this machine. Both reuse canvases without resetting their backing size on each sample. The new check runs twice a second, so these per-operation figures do not claim lower total sampling CPU. Quiet footage reduces intended routine model work from about three to one frame per minute, while active footage can add up to six extra inference attempts. These measurements exclude video decode, model inference and sustained real-user resource use. They do not guarantee lag-free playback on every device.

The runtime/dependency graph is unchanged. The dependency audit still reports the previously documented three high sharp and one moderate sprintf-js advisories in native Node paths excluded from the browser runtime; the source graph is not audit-clean. Browser fixtures control video pixels and caption outcomes. No new public YouTube-player or regular-profile Edge test was performed for this release.

## Update

Reload Recall at edge://extensions or chrome://extensions, refresh existing YouTube tabs and reopen popup/settings. The version should read **2.15.0**. Keep the installed folder path unchanged to preserve the local library. Updating from v2.13/v2.14 needs no runtime rebuild; teammates can pull and reload. Older source checkouts need `pnpm run setup`; the packaged ZIP includes the runtime.

Half-second checks can still miss shorter flashes, subtle motion or semantically important changes below the visual threshold. The two-second gap, busy work, one waiting slot and rolling-minute budget deliberately limit coverage. OCR continues its separate five-second sampling; this change does not increase subtitle coverage or add simultaneous multi-video speech recognition.
