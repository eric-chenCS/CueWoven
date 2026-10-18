# Recall 3.3.4

Settings → Appearance offers System, Light and Dark. The choice is local and applies immediately to the popup, Library & settings and other extension pages. Lite mode remains a separate capture-performance option.

Both Your data retention menus offer 24 hours, 7 days, 4 weeks, 12 months and Forever. Four weeks means 28 days; 12 months uses 365 days. New installations default to four weeks for watched/read content and Forever for imports. Imported retention still uses the original visit date, so a shorter choice can remove old imports immediately. Existing older choices remain displayed as a previous setting and are preserved until explicitly changed.

Videos fetched at once supports 1, 3, 6 and 10 throughout the settings, service worker and queue. The default remains 6. Higher concurrency uses more browser resources; it does not speed up every indexing stage.

Validation: 229 Node tests; retention cutoff checks for all ranges; queue limits at 1/3/6/10; isolated browser preference, cross-page theme and legacy retention checks; a real service-worker 10-way controlled-caption pipeline including pause, window cleanup, original dates and timestamp search. YouTube responses in this pipeline are fixtures, not a claim about live-site throughput.
