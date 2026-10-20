# CueWoven v3.3.29

**New look.** The accent color changes from teal to cobalt blue (#1D4ED8 in light mode, #8AB4FF in dark mode). Link, button and dark-mode contrast stay between 5.2:1 and 8.2:1. The News site group takes the old teal so it stays distinct from the accent. The icon is redrawn as a magnifier shaped like a Q ("Cue"): a white ring with an amber handle on a cobalt tile, outlined in navy so it stays crisp at 16 px. Its scalable source is `icons/icon.svg`, from which the 16/32/48/128 PNGs are generated. The warning red for destructive actions is unchanged.

**Switches.** Every on/off setting is now a switch, since settings apply as soon as they change. Switches disabled by Lite mode appear dimmed. **Search this video** in the popup stays a checkbox because it narrows a single search.

**Choose sites on first run.** The welcome screen offers the suggested sites as three groups (News, Reference, Social), all off. Choosing any and pressing **Start saving** asks the browser once for exactly those sites; denying changes nothing, and choosing none keeps YouTube only with no prompt. Suggested sites remain under Websites.

**How to open CueWoven.** The welcome screen, the popup's empty state and a new Settings row show the keyboard shortcut Chrome actually assigned (Ctrl+Shift+F by default, ⌘+Shift+K on Mac). They omit it when another extension already uses the key, Settings links to Chrome's shortcut page, and a "pin it" tip appears only while the icon is unpinned.

**Removed: address-bar search.** The `rc` keyword is gone. A two-letter keyword captured ordinary searches, such as ones for the CW network, and the shortcut and toolbar icon already cover opening CueWoven.

Also: the article-image hint now points to the Image storage setting, and the user-guide screenshot is retaken.

Validation: all 286 Node tests pass (the address-bar test was removed with the feature). In Chromium, the new welcome-sites check covers groups starting off, one permission request, denial and YouTube only. The branding check now verifies that no keyword exists, after starting the engine before its direct offscreen calls. Preferences, gray theme, minimal UI, v3.3 features, backup, Enter-search, demo fixes and icons checks pass. Contrast ratios were computed for both themes, and the icon, Settings and popup were reviewed in light and dark. No permissions or dependencies changed; the manifest drops only the omnibox keyword.
