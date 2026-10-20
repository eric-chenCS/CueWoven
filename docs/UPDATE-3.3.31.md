# CueWoven v3.3.31

**Example searches.** The popup's empty state now shows one of twelve example searches each time it opens, each showing something search understands: describing a moment, naming a site, typed dates ("3 days ago", "yesterday", "between 1 and 2 months ago"), what was on screen, text read from the screen, channel names and exact quoted phrases. The date and site examples were checked against the search parser so each triggers the filter it suggests. Examples read as "Try: …" so quoted phrases don't nest inside quotes.

**Pasted links fetched at once.** The Advanced setting formerly called "Videos fetched at once" is renamed and explained: it only applies to videos added under Add videos or with Fetch missing transcripts, not videos you watch. Add videos states how many pasted videos are read at a time and where to change it, and that number follows the setting.

Validation: all 290 Node tests pass. In Chromium, twelve popup opens showed six to seven different examples without horizontal overflow, the Add videos hint followed the setting through changes and reloads, and the minimal UI, Enter-search, v3.3 features, preferences and background transcript checks pass. No permissions, dependencies or storage format changed.
