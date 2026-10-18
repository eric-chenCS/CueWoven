# Recall v3.3.17: quieter surfaces, clearer actions

This release combines the installed slate/teal proposal with the earlier theme's clear white keyboard focus. Dark mode uses a dark slate-gray background (#14181F), slightly lighter panels (#202630), soft off-white text, teal controls and quiet separators. Controls keep visible borders. Light mode uses cool paper and white panels, darker teal actions and black focus. Red warning borders and amber search highlights remain.

Website groups receive subtle blue, violet, pink and teal tints. The headings, domain names and remove-button labels still identify each group and action without relying on color. The existing browser favicon/local globe fallback remains; a browser check forces an icon failure and verifies the local fallback loads.

The choice prioritizes scan hierarchy and clear actions while reducing large bright fills and heavy borders. It is a design judgment, not evidence that slate reduces eye strain or that every user prefers dark mode. System, Light and Dark choices remain available. Layout, capture, search, storage limits and personal data are unchanged. No new model or background task is introduced.

## Validation

- All 288 unit tests pass. The browser preferences test verifies theme persistence, explicit theme overrides and system fallback.
- The theme browser test checks popup/settings colors, white/black focus, red danger borders, group labels, favicon fallback and horizontal overflow at 320, 768, 1024 and 1440 pixels. Screenshots of both themes were visually reviewed with synthetic site data.
- Tested body, secondary, muted and action text against the principal background/surface/recessed colors, button labels, danger labels, selected-state text and tinted site-chip text meet 4.5:1. The lowest tested pair is **5.43:1 dark / 4.60:1 light**. Strong control borders against panels reach **3.80:1 dark / 3.28:1 light**; decorative separators intentionally remain quieter. These checks do not constitute a full WCAG audit or user study.
- Accessibility reference: [W3C contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

The unchanged dependency audit reports three high Node-only `sharp` advisories and one moderate Node-only `sprintf-js` advisory, outside the browser bundle. Existing remediation remains deferred for review by 2026-11-17.
