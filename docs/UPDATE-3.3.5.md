# Recall 3.3.5 — website settings review

The supplied recall-3.3.4-websites-update ZIP contained a focused ten-file update, not a full extension. Its website design is adopted: one saving switch, 30 grouped suggested news/reference/social domains on a fresh setup, custom additions, removal buttons, access repair, optional all-public-site saving, query/audio switches, and editable exclusions. The popup uses Start/Stop saving sites.

Corrections made before integration:

- Removing a site in all-sites mode now excludes it from future capture; saved items are kept. Removing in list mode removes it from the list. Forget deletes saved items and excludes capture/import until allowed again.
- Re-allowing an excluded site adds it back to the list. A blocked parent cannot be bypassed by adding its subdomain.
- Browser permission checks cover HTTP and HTTPS. A denied request rolls the switch back to the saved value.
- Private-page checks remain heuristic; privacy and local English speech/model-download explanations remain visible in expandable help. Lite mode's effect on video audio is indicated.
- Suggested defaults are display choices on a new setup only. The ZIP's backend default-domain expansion was omitted. Existing configurations, including an empty/partial one, do not gain new domains automatically.
- The supplied article test now opens More options only when closed, rather than accidentally closing it before Forget.
- Long domain chips wrap at phone widths. All settings, themes, retention and concurrency choices from 3.3.4 remain.

The update introduces no dependency, runtime, permission, database or search-model changes. The native dependency audit still reports three high sharp advisories and one moderate sprintf-js advisory through the native Node paths; those paths remain excluded from the browser bundle. No clean-audit claim is made.

Reload the extension and refresh Library & settings. Existing allowed website tabs may need a refresh after enabling access. Suggested sites do not imply every page can be captured: privacy filters and site compatibility still apply.

Validation: 230 Node tests pass. Isolated website UI checks cover keyboard toggling, denial rollback, access indicators, all-sites removal and re-allow, blocked parents, long domains and four widths. Existing article/search/import/backup, capture-clear, forget, minimal UI and preference browser suites pass. The extracted ZIP passes the website suite. Public pages and permissions in these browser checks use controlled fixtures; no private browsing history was scanned.

A mutation check disables the all-sites removal exclusion in a disposable copy; the new website regression fails at the blocked-domain assertion. Production source stays unchanged.
