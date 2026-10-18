# Recall v3.3.9: short-video capture

- Detects YouTube `/shorts/ID` and `/live/ID`, including feed changes without a navigation event. Reads matching Shorts or regular player metadata without delaying the initial announcement.
- Caps the save wait at five seconds for Shorts and videos shorter than three minutes, while respecting shorter user settings.
- Saves YouTube title metadata before caption retrieval. Missing captions retain a searchable title; successful captions or optional speech add content later. Existing transcripts are preserved.
- Saves allowed website videos' titles and scoped post captions upon identification, including Instagram Reels, TikTok and other sites using the same capture path. This works without captions, speech or scene snapshots. Embedding and storage complete asynchronously using the existing local text model.
- Selects visible active video elements for scenes, screen text and speech; an empty selection cannot fall back to a preloaded neighbour. Detects post changes even when a site reuses one video element, and avoids stale page canonical URLs.

Website saving still requires enabling each site and granting browser access. Private pages, exclusions, paused saving and incognito remain excluded. The speech setting is preserved.

To update while preserving your library, back it up, replace the contents of the currently loaded extension folder with this version, reload the extension, and refresh your video tabs. Loading a different folder can create a separate extension identity.

Validation: the full Node test suite and controlled Chromium feed tests for Instagram, TikTok, Facebook Reels and X. The browser tests use real media elements with controlled platform markup and a stub message transport; they do not establish compatibility with every live platform layout. No dependencies changed. The package-manager audit was attempted but its registry fetch failed in this environment.
