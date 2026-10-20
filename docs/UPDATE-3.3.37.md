# CueWoven 3.3.37

Search this video can use saved speech, on-screen text and scenes even when captions are unavailable. A saved title alone still triggers initial capture. The search remains scoped to the current video.

Article results now use literal query wording within the retrieved passage as the jump target, with saved surrounding words to distinguish repeats. This handles phrases beyond the opening words, paragraph boundaries, inline formatting and delayed rendering. If an exact passage cannot be distinguished on the current page, the extension reports that it could not find it. Similar-meaning results scroll near the saved passage without highlighting its words and show **Suggested section · Similar in meaning**. Clicking, typing, keyboard navigation, touch or scrolling dismisses the suggestion; early interaction cancels a pending semantic jump. Existing copied links retain their original behavior.

On first setup of automatic Lite mode, including an update from older versions, devices reporting 8 GB of physical RAM or less switch to Lite mode. Captions and article text stay enabled; new speech, scene, article-image and OCR capture pause. Users can turn Lite mode off, and their choice survives restarts and later updates. Reset restores the device-based default. Detection uses the new **system.memory** permission locally; no hardware information is uploaded or capacity value persisted. Failed detection preserves the current choice or the normal Off default and can retry on a later worker start.

The models, embeddings, ranking rules, timestamps and saved-library format are unchanged from 3.3.36. Previously saved media remains searchable in Lite mode. This is not a fixed RAM cap or a performance certification for physical 8 GB laptops.

## Validation

All 319 Node tests pass. Isolated Edge checks exercise the real local search/model workers with controlled page, caption and RAM fixtures: scoped-video captions/speech/OCR/scenes; exact article targeting and repeated/late text; semantic suggestion display/dismissal; device defaults, manual overrides, reset and settings-save ordering. The real physical-memory API was also checked on the test laptop. Preference, article/page and Enter-search regressions are included in release verification. Tests on controlled fixtures do not establish live YouTube caption availability or arbitrary-site compatibility.

The normal download includes the generated runtime. The store upload ZIP is kept local and is not a public release asset. Dependency versions are unchanged; the previously documented Node-only audit findings are not resolved by this release.
