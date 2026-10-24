# CueWoven 3.3.55 beta

**Web searches follow one setting.** CueWoven used to recognize only Google search pages. With "Save every site" turned on, search result pages from Bing, DuckDuckGo, Yahoo, Brave Search and Ecosia were saved as ordinary pages, query included, even with search saving off, and the medical-query filter did not apply to them. All six engines now follow the same rule as Google: nothing is saved unless "Save my web searches" (renamed from "Save my Google searches") is on, obvious medical searches are never saved, and saved addresses keep only the search words. The background now decides whether a page is a search from its address instead of trusting the page. The privacy policy names the engines.

**Image search retry.** When the image model was still loading, the popup said "Search again in a moment to include images", but repeating the search within 30 seconds returned the cached text-only result. A search that ran before images were ready is now run again.

**Name.** The extension is now called "CueWoven: Search Your History".

Validation: 408 unit tests pass, including new tests for every search engine and for the image-search retry. All 83 browser test programs were run: 67 pass, including the maintained set. Failures in older experiments were each traced to missing local fixtures (photos, baseline snapshots, extra model folders) or to assertions written before later deliberate changes (paused capture refusing new frames, explicit website filters no longer relaxed, renamed Lite mode wording, a newer database version, single-shot searches that predate the image-search time budget).
