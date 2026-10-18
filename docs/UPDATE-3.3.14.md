# Recall v3.3.14: article images

Allowed public article pages can now save up to three visible, loaded images from the main article. Each local copy is a JPEG of at most 320 pixels per side. Logos, navigation, sidebars, hidden images, private pages, background tabs and inaccessible images are skipped. Cross-site copies require a successful anonymous CORS request. No image proxy or external recognition service is used.

Alt text and figure captions join text search. The existing local CLIP model also finds images by appearance; results show **Article image**, a preview and a link back to the article. This is a compressed memory aid, not a full-resolution image archive or a complete page/video download. It does not backfill imported history, read text inside static pictures, or guarantee capture on every site.

**Save article images** defaults on within sites the user has already allowed. Disable it in Settings, or enable Lite mode to pause new image capture. Existing site choices, exclusions, toolbar access, Ctrl+Shift+F and history remain. Images are not redacted; existing private-page heuristics cannot identify every private page.

## Storage and responsiveness

- Article images reuse the existing visual store: three per page, 2,000 visual records total and a shared 24 MiB accounting limit. The oldest article images or video snapshots are evicted when that limit is exceeded. Captured captions remain searchable text. Backup/restore includes images and captions; deleting or forgetting an article removes its visual records.
- Capture runs after page text is saved, one image at a time, without blocking page-text capture. Candidates, dimensions, retries, request duration, received bytes and background capture rate are bounded. The vision worker releases after 60 seconds idle and has a processing deadline.
- Search skips visual inference while an image is being indexed. Otherwise it waits at most 1.2 seconds for optional visual ranking and then returns text results with a preparation notice; search again after preparation for visual results. Late results do not reorder a result list the user is already using. This budget applies to the optional visual stage, not to the complete first model download or the entire text-search pipeline.
- CLIP was already used for video snapshots. If it is not cached, its quantized vision/text weights download roughly 154 MB in total on first use. Inference remains on device. First use costs more time and memory than warm search; no additional model architecture, dependency or re-embedding migration is introduced.

## Verification on this machine

- 288 unit tests pass, including article-image validation, active/private-page boundaries, rate limits, fusion labels and visual search deadlines.
- Chromium with the production quantized CLIP model captures three images, recognizes a public cat photograph from three descriptions, finds its caption, preserves the page record type, skips blocked CORS/private pages, respects the capture setting, restores backups, handles deletion during inference and enforces the shared visual quota. The popup shows the image label and article link.
- Warm visual searches in the small four-image fixture took about 23–39 ms; the first CLIP text-model initialization/search took about 0.6–0.9 seconds with weights already local. Initial article capture took about 14 seconds including the normal five-second page dwell, model initialization and sequential capture ticks. These are small-fixture measurements, not a large visual-library benchmark or network download estimate.
- A live **American bison** Wikipedia page saved an article image in an isolated browser profile. Existing page-capture tests pass, including private/form exclusions, backup, clear races, forgetting sites and responsive settings layouts.
- Production quantized MiniLM retrieval remains **120/121 top-1 and 121/121 top-5/top-20**. An isolated copy of the existing 2,511-item library retains **41/41** title-derived development checks, with warm searches about **24 ms median / 32 ms p95** during the test run. These checks are not a blind human-authored evaluation; that library has no captured images.
- The 30,000-passage transcript ranking fixture remains about **70–75 ms warm**, after about **3.4 seconds** of incremental cold preparation. No re-ranker or embedding-model change is shipped.

No personal history, model weights or private test profiles are included in source or the package.

## Dependency audit

The unchanged lockfile reports three high Node-only `sharp` advisories and one moderate Node-only `sprintf-js` advisory. Neither package is included in the shipped browser bundle. The existing Node-toolchain remediation remains deferred for review by 2026-11-17; the audit is not clean.
