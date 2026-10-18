# Recall v3.3.15: ten times the visual storage

The shared article-image/video-snapshot budget increases from 24 MiB to **240 MiB** (251,658,240 bytes). The combined record limit also increases from 2,000 to **20,000**, so it does not prematurely constrain the larger byte allowance. Older visual copies are removed first when either limit is reached. Existing saved content is retained; previously evicted images cannot be recovered automatically.

Capture stays at three images per article and 240 snapshots per video. Full video files and original-resolution images are not archived. This is a visual-data accounting cap, not a total extension-storage cap; model files, text, transcripts and browser database overhead are additional. The larger budget is available capacity and is not allocated or downloaded in advance.

Settings, installation instructions and the README show the new limits. No browser permission, dependency, database migration or model change is required.

## Validation

- All **288 unit tests pass**, including explicit byte/count/per-item limit assertions.
- An isolated Chromium extension test seeds 20,001 snapshots across 84 parent records, inserts a new snapshot and verifies the oldest two are evicted to retain exactly 20,000. Search metadata excludes JPEGs.
- A **239 MiB** image payload remains stored; adding another **2 MiB** evicts the older payload and preserves the newer one. Test payloads exercise storage directly, without image inference.
- Reading and ranking all 20,000 stored 512-dimensional vectors took **454 ms cold and 294–304 ms on repeated reads** on this machine. This excludes model inference, text ranking and UI debounce; the existing 1.2-second optional visual-search deadline remains in force. The full-capacity background insertion/cleanup took about **2.3 seconds**. Capture remains asynchronous; a library this large costs more work than a small one.
- The unchanged production dependency audit still reports three high Node-only `sharp` advisories and one moderate Node-only `sprintf-js` advisory, outside the shipped browser bundle. Existing remediation remains deferred for review by 2026-11-17.

The capacity fixtures contain synthetic data only; the installed browser library is not used for destructive tests.
