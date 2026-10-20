# CueWoven v3.3.35

## Text-first search

Relevant transcripts, speech, OCR, page passages and titles now stay ahead of scene similarity. Close lexical evidence or the existing 0.45 strong-text threshold keeps the result pool text-based. Only when that relevance check finds nothing does search query CLIP and use eligible scenes/article images as fallback. The choice is made before pagination, so later pages cannot introduce unrelated scenes. Scenes no longer boost a weaker text result or replace its spoken timestamp.

## Automatic capture and cleaner search

The popup no longer includes Save now, Save page or the Speech-to-text controls. Automatic saving remains enabled by default. YouTube tries captions first and starts local English speech fallback when captions are unavailable; missing or undetermined language metadata permits an English attempt, while known non-English audio is skipped. Settings can stop/resume transcription without a popup speech button. Save automatically, Lite mode, site exclusions, incognito avoidance and existing site-audio choices remain respected. Website audio still requires its separate opt-in. Audio is processed locally from played media, not the microphone, and is not saved as a recording.

README and installation guidance now distinguish the named installation ZIP from GitHub source archives, explain full extraction and tab refresh, and cover browser site access, first-run models, cross-computer backup transfer and module-loading diagnostics. The stale add-a-link empty-state hint and a broken privacy-section heading are corrected.

## Compatibility and limits

Model weights, dependencies, browser permissions, capture data formats and the database schema are unchanged. Text ranking itself is unchanged; text-versus-visual result selection intentionally changes. Saved libraries need no reindexing or migration. Relevance is heuristic: a coincidental strong text match can suppress image fallback. English recognition can be inaccurate when unknown-language audio is actually non-English.

The reported Edge error referencing vendor/ocr/ocr.bundle.js was not reproduced with the complete v3.3.34 runtime in a fresh Windows/Edge profile. That file is present in both release packages; updated instructions help diagnose wrong source downloads, extraction problems or blocked requests, but do not establish the cause on the affected computer.

## Verification

- 289 Node tests pass; new visual-priority regressions fail against the former blending logic and pass with fallback selection.
- Real MiniLM benchmark: correct video first for 121/121 controlled queries across 36 videos, with social source/date filtering and UI checks.
- Real-model Edge fallback regression: text order/timestamp retained, no visual inference for relevant text or later pages, and actual CLIP retrieval for a visual-only cat query.
- Edge scene regression: actual capture, visual retrieval alongside unrelated transcripts, previews, backup restore, migration, storage limits and retention pass.
- Real Whisper plus MiniLM in Edge: normal playback automatically saves partial speech with undetermined language metadata; search timestamps, backup restoration, settings stop/resume, ended cleanup and full-caption replacement pass without speech-button clicks.
- Edge popup/layout, theme/contrast and diagnostics/site-forgetting checks pass. Documentation validation checks 34 local links/anchors and runtime filenames against the release asset.

Controlled browser fixtures and synthetic audio do not establish universal accuracy or live-site coverage. No new successful live YouTube-caption claim is made.

## Dependency review

The native pnpm audit retains three high-severity sharp advisories and one moderate sprintf-js advisory through onnxruntime-node. Those Node-only packages are absent from the reviewed browser bundle graph and release archives. Runtime vendor files are unchanged from v3.3.34. Dependency upgrades remain deferred to a separately tested compatibility update; review by 2026-11-20 or the next release, whichever comes first.
