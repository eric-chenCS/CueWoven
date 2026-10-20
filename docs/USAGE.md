# Using CueWoven

[Install first](../INSTALL.md), then open the search popup either way: press **Ctrl+Shift+F** (**⌘+Shift+K** on Mac), or click the CueWoven toolbar icon (pin it from Chrome's puzzle-piece menu to keep it visible). Chrome skips the shortcut if another extension already uses it; Settings shows the current one and **Change** opens Chrome's shortcut page. Your library can start empty or with optional original sample videos.

![CueWoven library populated only with five original demo videos](assets/library-demo.png)

*Sample content in an isolated browser profile.*

## Search what you remember

Describe an idea, phrase, image or scene, then press **Enter**. Typing alone does not run a search or show matches. Editing the query hides old matches until you submit again. Each search is independent. After a search, **Not it? Add a detail** below the results adds one thing you remember (something said, something on screen, a channel or site, or when), and it opens on its own when nothing matches. Details build up as tags under the search box; ✕ removes one and searches again. **Not this one** on a result hides that item and searches again; the "hidden" tag brings it back. Editing the search clears its details and hidden items. Source/date filters narrow the results: **Any time**, **Today**, **7 days**, **30 days** or **Custom**, which shows From/To dates for an exact range. You can also type when you saw something: "3 days ago", "3-4 days ago", "between 1 and 2 months ago", "a few weeks ago", or, with words like "I watched", "yesterday", "last 3 days" or "in September". Typed dates are padded because memory is fuzzy, appear under the search box as "Using: …", and can be turned off with **Ignore suggested filters**; if nothing matches, results without them are shown. A date chosen in the popup always wins over a typed one. Results show the best match as a larger card. **Other matches** below it opens up to three more videos or pages as compact rows, one row each; it starts folded when the best match is confident and opens by itself when the top two nearly tie (the second row says **Almost as good**) or when the best match is only related in meaning. **Show more** reveals more rows and loads further ranked matches as needed. ↑ and ↓ move through all results, and Enter opens the selected one, or the best match.

A moment is a saved passage or observation at a video time. Indicators identify the evidence: Transcript, Audio, Scene, On-screen text, Article image, Image caption or Title. Title-only results open a source without claiming a matching spoken timestamp. Scores express ranking, not probability.

Press Enter once to search; press Enter again to open the shown result, or use **Copy link**. **Search this video** restricts search to the current YouTube video and tries indexing if needed.

## Choose what gets saved

Saving is enabled with YouTube as the only starter site. On first run, the welcome screen offers the suggested sites as three groups (News, Reference, Social), all off; choosing any and pressing **Start saving** asks the browser once for just those sites. Add them later, or your own domains, under Websites. Browser access is requested on a user click; already granted access may not show a new prompt. Refresh existing tabs afterward.

The × beside a site excludes future capture while keeping saved items searchable. The popup's **Forget site** action deletes saved items for that site and blocks future capture. The site list and extra options can be collapsed. Broader public-website access is optional.

Allowed pages contribute up to 2,000 visible words and up to three accessible article images. Compatible visible video players can contribute native captions, played speech, scene snapshots and on-screen OCR. Website audio transcription is separately off by default. Native social-media apps, inaccessible frames, protected media and login walls are outside coverage. Feed URLs may reopen a feed rather than an exact clip.

Speech fallback is local and English-only. Known non-English or ambiguous mixed-language metadata skips automatic fallback; manual Start English transcription can override incorrect metadata. It processes only audio played after starting, one player at a time. Audio is not saved as a recording.

Visual capture samples frames; it does not continuously archive a video. Short events and small or stylized text may be missed. **Lite mode** pauses new article images, scenes, OCR and speech while keeping captions and article text. Settings also provide individual controls, light/dark/system appearance and **Reset settings to default**. Reset preserves the library, site choices and retention preferences.

## Add specific videos

Paste YouTube links under **Add videos** to fetch available captions for videos you choose. There is no Takeout importer or browser-history scan. Background fetching uses a separate minimized window with muted player tabs; it is visible in the taskbar and must remain open. Under Settings → Advanced, **Pasted links fetched at once** chooses 1, 3 (default), 6 or 10 parallel videos; it only affects pasted links and Fetch missing transcripts, not videos you watch; fewer use less CPU and memory and keep the computer quieter. Settings can close after fetching starts, but the browser must stay open. Closing the capture window pauses new work. Retry unavailable captions later; this does not recover unwatched audio or scenes. Live capture can continue alongside the caption queue.

Older saved title-only entries remain available and can use Add transcript. **Fetch missing transcripts (N)** under Add videos appears only when some saved videos are title-only or have AI speech for just the parts you played; it fetches full captions for them, newest first. Removing history import does not delete an existing library or reject an old CueWoven/Recall/Momento backup.

## Privacy and data

Your library, vectors and settings are stored in the current browser profile. Local models process search text, audio and images on your device. Model weights download from Hugging Face on first use; normal website/YouTube requests and thumbnails still use the network. No personal YouTube API key is required.

Site allowlists, exclusions, incognito avoidance, sensitive-route filtering and text redaction reduce unwanted capture. They cannot identify every signed-in/private page, and captured images are not redacted. Grant access only to sites you want to save; pause capture when appropriate. Diagnostics show approximate storage and a bounded session-only domain/reason log rather than full page content.

Under **Your data**, export/import backups, clear the library, or forget items saved recently. One JSON backup contains saved transcripts, page passages, titles, source links, timestamps, OCR text and captured images. Treat it as private and do not commit it to the repo. It does not contain original video files, recorded audio, complete websites, settings, site permissions or downloaded models.

Uninstalling the extension or clearing its browser profile can erase the library. There is no account or automatic cloud sync. Export before switching profiles/computers or uninstalling, then restore into the new installation. A source that disappears cannot be brought back online by the backup; only previously saved evidence can be restored. Keep settings open during restore; stop speech and pause transcript fetching before restoring. Completed batches remain if a restore is interrupted.

Retention choices are 24 hours, 7 days, 4 weeks, 12 months or Forever. Watched/read content uses the applicable recent capture/watch date. Existing legacy imported records retain their original protection and stored retention preference for compatibility; the old import setting is no longer shown. Watching such an item makes normal live retention apply. **Forget recent** uses when CueWoven saved/updated an item. Export before deleting if you need a copy.

**Image storage** under Your data bounds scenes and article images to 120 MB, 240 MB (default, up to 20,000 images), 500 MB or 1 GB of accounted compressed-image/vector payload, with the image count scaled to match and 240 images per video. Larger sizes keep more images but load more search data into memory for each image search, about 40 MB at the default and 170 MB at 1 GB. Lowering the size asks first, then removes the oldest images that no longer fit. Images otherwise follow **Forget what I watch or read after**; if the size is reached first, the oldest images are removed early and Your data says so. Full web content has a separate 2,000-item or 64 MiB accounted payload cap, with older items retained as titles. Models, browser storage overhead and other evidence use additional space. This is a searchable memory aid, not a complete archive.
