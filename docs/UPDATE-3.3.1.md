# Recall 3.3.1 — supplied minimal UI

Applied the presentation from the user-provided `recall-3.2.1-minimal-ui.zip` to the current v3.3.0 extension. The older package's capture, search, storage and import implementation was not substituted for the newer code.

## Design

- Search stays first in the popup. Time/source filters share a row; the default best-match view has a larger preview and yellow timestamp. Match sources remain visible, arrow navigation remains icon-only, and Copy link stays on each result.
- Teal actions, cool neutral surfaces and yellow text highlights follow the supplied CSS, with light/dark themes and reduced-motion support. No external font, framework or dependency was added.
- The library uses the supplied sidebar and bordered rows. Import tools, advanced settings and diagnostics open as native disclosures. Import progress reveals its collapsed row. On narrow windows, the sidebar becomes a sticky scrolling menu, and section headings clear it.
- Shorter counts and metadata reduce visual noise. Extra evidence counts and details remain in tooltips; result indicators still distinguish transcript, audio, scenes, on-screen text, page text and titles.
- Current-video scope, Retry, the suggested week filter, optional original sample videos, copy links, Google-query consent, Light mode and Forget recent remain available. Manual English speech is retained in a popup disclosure; the reference's rule that permanently hid Start was not adopted.
- File selectors remain native keyboard-focusable inputs with visible focus around their labels. The skip link targets the main content. Permission choices, retention consequences, background-fetch limits and privacy limitations remain available next to the relevant controls or under their disclosure.

## Verification

- All 223 Node tests pass.
- The UI browser test verifies sidebar selection, welcome-file reveal, native file focus, progress disclosure, sample search, copy-link visibility, visible result arrows, retained current controls, and light/dark rendering. Settings have no horizontal overflow at 320, 768, 1024 and 1440 pixels; anchor headings clear the narrow sticky menu. The popup fits its 440-pixel width and 600-pixel maximum height in the tested sample state.
- Disabling automatic progress disclosure deliberately fails the new browser regression; the correct script was restored.
- The existing v3.3.0 feature, single-result navigation, article/import/backup, capture diagnostics, 205-title/newest-200 queue and actual automatic English speech tests pass with the adapted UI. Existing behavioral tests explicitly open a disclosure before interacting with a folded control. Clipboard wiring still uses a stub to avoid changing the system clipboard.
- Screenshots were inspected for the popup and library in both themes and for narrow settings. Testing used isolated Chromium, controlled article/video fixtures, real local models where applicable, and no user history or private Edge profile.
- All 52 files across `background.js`, `lib/`, `content/` and `offscreen/` match v3.3.0 byte for byte. No database migration, model/runtime rebuild, host permission change or dependency change is introduced by this UI update. The new release does not claim an additional search-speed or model-accuracy gain.
- The unchanged locked-dependency audit on 2026-10-17 still reports three high `sharp` findings and one moderate `sprintf-js` finding in the native Node paths excluded from the extension's browser runtime. See the v3.3.0 notes for scope; these are not presented as a clean audit.

## Update

Keep the same unpacked folder to preserve extension identity and browser storage. Reload Recall in the extension manager, then refresh existing YouTube/website tabs and reopen or refresh Library & settings. The extension manager and settings sidebar show **3.3.1**; the popup brand stays simply **Recall**, with its version in the tooltip. The supplied v3.2.1 ZIP is a UI reference, not the version to load over your current library.
