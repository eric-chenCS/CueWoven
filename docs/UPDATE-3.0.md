# Recall 3.0.0 — websites, articles and browser videos

Recall now searches saved web-page text, Google search queries and compatible browser video evidence alongside the existing YouTube library. Website capture starts off. The user chooses specific sites or broader public-web access through optional host/scripting permissions; required install-time host access remains YouTube only. Website speech recognition has a separate off-by-default switch.

## What is saved

- Extracted Takeout Chrome `BrowserHistory.json` and Google My Activity/Search JSON import titles, URLs, queries and dates locally. The optional browser scan imports this profile's saved visits. YouTube links use the existing video-title importer. Nothing fetches old page bodies or automatically plays old website videos. A visit is not proof of watching/reading. Re-import skips completed duplicates; dates are deduplicated per normalized URL/query.
- Allowed live pages save visible text, up to 2,000 words, with passage anchors. Password/editor pages, incognito, known sensitive domains/paths, unsafe URLs and explicitly blocked sites are skipped. Filtering cannot detect every private or signed-in page; allow specific domains. Pause and Forget this site are available. Forget also blocks future saves, including YouTube capture when that site is excluded.
- Compatible visible top-level HTML players use played native caption cues, the existing adaptive scene sampler and English OCR. Optional local English Whisper handles usable player audio when captions are unavailable. A largest-visible-player policy and existing processing budgets limit work. Portrait scenes retain their aspect ratio within the same 57,600-pixel limit. Background/hidden players are skipped; automatic speech runs one player at a time.
- Everything/Videos/Pages/Searches filters use one shared ranking path. Article passages open text-fragment highlights. Website video results use a time fragment handled by Recall's allowed page script. Direct post links work best; dynamic feeds may reopen a feed rather than the precise clip.

Native mobile apps are outside browser-extension access. Login walls, cross-origin/protected video, embedded frames and unavailable caption/audio/pixel access can prevent capture. Caption/OCR/audio coverage is sampled or played portions, with recognition errors possible. This release does not promise every Instagram or TikTok video works.

## Storage and compatibility

IndexedDB schema 4 adds a web-item passage store and preserves legacy video IDs, captions, dates, scenes and OCR stores. Backup format 2 adds web items, text anchors and audio coverage; old format-1 backups still restore. Restores rebuild vectors in small requests and retain original dates. Mutation holds cancel and drain pending website and caption writes before Delete/Clear/Forget/restore, preventing late saves from resurrecting removed content. General-history imports can coexist with watched-video indexing.

Web passages use 384-element signed 8-bit vectors plus a scale. Their vector payload is four times smaller than Float32; this is not a fourfold reduction of the whole library or model memory. Search reads 32 web items at a time instead of materializing all web passage vectors into a second full-memory index. Each item holds at most 160 passages including its title. Full web content is capped at 2,000 items or 64 MiB of accounted text/anchor/vector payload; oldest full content becomes title/query-only. Metadata, title vectors, database overhead, legacy video stores and model memory are additional. Browser quota still applies. Imported metadata remains protected until visited/captured live; live items follow retention. Existing scene/OCR limits remain shared across sources.

No new dependency or runtime build is required when updating from v2.13–v2.15. The existing MiniLM, CLIP, English Whisper and Tesseract models run locally. First-use model downloads and inference can use noticeable CPU/memory. Public-page visits still contact their websites normally; saved content and audio are not sent to a transcript/OCR service. A local generic icon avoids making favicon requests for imported sites.

## Verification

- All 188 Node tests pass, including parsing/localization, URL/permission/privacy gates, stable identities, quantization error, text anchors, cancellation, backup dates/audio ranges, portrait frame budgets and explicit YouTube exclusions. Deliberately inverting the website-enabled guard makes its regression tests fail; the original guard was restored.
- Isolated Chromium: file-input general imports, semantic article search, source filters, first-run capture off, form/password exclusions, text-fragment links, Delete/Clear/Forget, backup restore and responsive light/dark UI pass. Browser fixtures pregrant optional permissions only in their temporary manifest; the native permission dialog is not automated.
- Controlled Instagram/TikTok-origin pages with actual HTML players pass real MiniLM, CLIP, OCR and Whisper capture/search, native-caption suppression of automatic speech, timestamps and backup restore. These controlled pages establish the pipeline, not production-platform compatibility.
- A real public Wikipedia article automatically saved searchable text after model warmup. A real TikTok request was connection-reset, and an Instagram profile exposed no playing video. Real production social-video capture remains unverified; no personal accounts, history or cookies were used.
- Real IndexedDB storage checks preserve all 2,000 synthetic item titles while enforcing the full-content count cap. A separate large-text fixture stayed below 64 MiB by downgrading old full content. Warm 2,000-item synthetic queries measured 46–96 ms on the test machine, excluding cold model load; this is not a performance guarantee for every library/device.
- Existing YouTube scene/storage, capture-hold, import-integrity, automatic speech and six-player background transcript regressions pass. YouTube responses in background tests are controlled; existing public-player limitations still apply.

The locked dependency graph is unchanged. Existing native Node audit findings (three high, one moderate) remain documented in TEST-REPORT.md; affected native paths are excluded from the browser runtime. This is not an audit-clean dependency graph.

Reload the same installed folder, refresh open tabs, then choose allowed websites/imports in Library & settings. Existing data needs no re-import. Broad website access and website audio remain opt-in.
