# CueWoven v3.3.26

**Custom dates.** The search date filter adds **Custom** after Any time, Today, 7 days and 30 days. It shows From and To date pickers for an exact range, such as one to two months ago. Either side can be left empty, reversed dates are swapped, future dates cannot be picked, and the popup remembers the range like the other chips. A custom range covers local midnight at the start of From through the end of To and is never relaxed.

**Typed dates.** Searches now understand "3 days ago", "3-4 days ago", "between 1 and 2 months ago", "a few weeks ago" and "two weeks ago". With viewing words such as "I watched" or "I saw", they also understand "yesterday", "last 3 days" and "in September" (the most recent September, or a given year). The date words are removed from the search text, and the window is padded because remembered dates are approximate: one day either side for days, half a unit for single weeks, months and years, and a quarter unit for spans. The window appears as "Using: …" under the search box, **Ignore suggested filters** turns it off, and results without it are shown when nothing matches. Topic phrases such as "30 days of running", "gardening in May", "yesterday lyrics" and quoted text are not treated as dates. A date chosen in the popup always wins over a typed one.

**One date check.** Videos, pages, on-screen text and images now share one watched-or-saved date check with both a start and an end, so every source filters the same way.

**Backup description.** Your data now explains backups in one short line, with **What's in a backup?** folding out what is included, what is not, how restoring works and how to keep the file private.

Validation: all 286 Node tests pass, including typed date windows at a fixed time, topic phrases that must not become dates, popup dates winning over typed ones, relaxing only typed dates, and the shared date check. The new tests fail without the change. The 30,000-passage ranking benchmark keeps the same result order at about 125 ms. The popup date pickers and backup fold-out were not checked in a browser for this release. No permissions, dependencies or storage format changed.
