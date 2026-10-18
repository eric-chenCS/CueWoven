# Recall 3.3.7

The duplicate Forget a site form is removed from Websites. The × beside a listed domain removes it from the active list and excludes future capture and imports in every saving mode. Existing saved memories are kept; the popup still has Forget and block for deleting a current site's stored items. Excluded-site chips remain available to explicitly allow a site again.

The website list is collapsible and shows its count. Initial setup populates the standard list of 31 news/reference/social sites, including YouTube and Instagram. It is initialized once, honors exclusions, preserves existing custom entries and adds YouTube when it is not excluded. Removing sites does not make them reappear on reload. A legacy active empty allowlist is paused before adding starter sites so it cannot silently expand active capture. YouTube's existing video capture follows Settings independently of generic website saving.

Website icons use the browser's favicon endpoint in the site list, library and results. Only the site origin is used for icon lookup. This adds the favicon permission. Cached/browser-default favicons and a bundled local globe prevent empty or broken images; saved scene previews and YouTube thumbnails remain preferred. There is no external favicon service or direct site-favicon fetch. Browser permission details: [Chrome favicon documentation](https://developer.chrome.com/docs/extensions/how-to/ui/favicons).

Ranked navigation keeps Best match first, followed by Match 2, Match 3, etc. Page and video matches use the same labels.

Excluding YouTube now pauses an active import transcript queue, settles capture tabs, and rejects further live audio packets. Existing import/live indexing guards remain in place.

Validation: 235 Node tests pass. Isolated browser checks cover starter seeding and excluded-site persistence, collapsing the list, browser-icon loading and local fallback, mixed page/video Match numbering, 14-result ranking/navigation, website permissions, active-job exclusion, articles/search/import/backup, responsive UI and preferences/reset. Tests use controlled pages and video responses. A disposable mutation that restores an excluded starter domain fails the seed regression. The dependency audit is unchanged (three high native sharp advisories and one moderate sprintf-js advisory); no dependency, model or schema upgrade is made.

Reload Recall, accept favicon access if the browser prompts, and refresh Library & settings and video tabs.
