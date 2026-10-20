# CueWoven v3.3.34

Privacy hardening extends the existing shared text redactor to recognizable API keys, authorization tokens, JWTs and private-key blocks. Existing email, phone, SSN and card redaction remains in place. New captures and restored OCR records use the same filters before embedding and storage.

Sensitive library commands now require the Library page; search and UI commands require the popup or Library. Direct engine messages require known extension pages or the service worker. Browser-provided sender IDs and exact page URLs are checked, including when the Library is open in a tab.

Pages with a private marker or visible payment fields are excluded. Additional credential URL parameters are excluded centrally; ordinary state and key parameters keep their identity. README, privacy disclosures, store text and visible version labels are updated.

## Search and data compatibility

No model weights, ranking rules, dependencies, extension permissions or database schema changed. Existing saved data is not migrated or automatically scrubbed. Ordinary indexed content retains its text and search behavior; text resembling credentials can be redacted intentionally. Credential detection is best-effort, and captured images are not redacted. Backup encryption is not part of this release.

## Validation

- 280 Node tests pass, including retrieval, capture cancellation, pause/exclusion, sender permissions, text redaction and OCR simulations.
- Chromium security checks exercise real page capture, five rejected website library/engine requests, normal URL identity, actual local-model search, backup round trips, OCR restore redaction and private/payment-page exclusions.
- Existing Chromium article, import-integrity and UI regressions pass, including semantic retrieval, capture-clear races, saved-data retention, themes and responsive layouts.
- Changed JavaScript syntax and Git whitespace checks pass.

Browser regression pages and permissions are fixtures in isolated profiles. This release does not claim new live YouTube-caption or Edge-certification testing. Earlier live-network validation is documented in [v3.3.33](UPDATE-3.3.33.md).
- Release accuracy benchmark: correct video first for all 121/121 fixture queries across 36 videos, with social source/date filtering and fallback checks passing. All 180 normal fixture text fields match the previous release's redaction output exactly.

## Dependency review

The native pnpm audit reports three high-severity sharp advisories and one moderate sprintf-js advisory through onnxruntime-node. These Node-only packages are absent from the browser bundle dependency graph and release archives; the shipped Transformers bundle matches the graph's reviewed build byte-for-byte. Dependency changes are deferred to a separate compatibility-tested update; review again by 2026-11-20 or the next release, whichever comes first. No forced upgrades were applied.
