# Recall v3.3.19: reference grays with colored controls

Dark mode returns to the user's reference grays: **#3D3D3D** background and **#333333** panels. Recessed surfaces, text, separators and control borders are neutral gray rather than blue-slate. Light mode uses neutral pale grays and white panels.

Teal buttons/switches, website group colors, amber match highlights, white/black keyboard focus and red warning borders are preserved. Website favicons, layout, capture, search and storage limits are unchanged. There is no additional runtime processing.

All 289 unit tests pass. The browser theme check covers explicit/system themes, popup/settings colors, responsive layouts, focus and warning colors. Tested text pairs remain at least **4.64:1 dark / 4.84:1 light**; strong borders against panels reach **4.83:1 dark / 3.74:1 light**. This is a targeted contrast check, not a full accessibility audit. Screenshots were reviewed in the isolated test browser.

The unchanged production dependency audit reports three high Node-only `sharp` advisories and one moderate Node-only `sprintf-js` advisory outside the browser bundle. Existing remediation remains deferred for review by 2026-11-17.
