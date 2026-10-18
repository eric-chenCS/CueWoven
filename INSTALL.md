# Recall v3.3.6 installation

## From the ZIP

Extract `recall-v3.3.6.zip` into a folder. Open `edge://extensions` or `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted folder containing `manifest.json`. The ZIP includes the runtime and five small original sample videos. Load the extracted folder, not the ZIP. If replacing an installation, back up the library and update the contents of its existing folder, then Reload and refresh video/website tabs. A different folder can create a different extension identity.

## From this repository

Install Node.js 22+ and pnpm 11.25.0. From the cloned repository, run `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm run vendor`, and `pnpm test`. Setup builds the required vendor runtime, which is excluded from Git. Then open edge://extensions or chrome://extensions, enable Developer mode, click Load unpacked, and select the repository root containing manifest.json.

## Existing installation

After pulling changes, rebuild with `pnpm run setup` if dependencies or the runtime build changed. Reload the Recall extension and refresh existing YouTube and allowed website tabs. Reopen Library & settings. The version should read 3.3.6 in the extension manager and settings sidebar. Keeping the same folder preserves the extension identity and local library.

Version 3.3.6 marks default choices and adds Reset settings to default in Settings. Reset preserves the library, retention choices, site lists/exclusions and browser permissions while restoring capture/search/appearance preferences. Reload Recall and refresh Library & settings. See [UPDATE-3.3.6.md](docs/UPDATE-3.3.6.md).

Version 3.3.0 improves search responsiveness and history indexing and adds current-video search, copy links, samples, `rc` address-bar search, capture status, Lite mode and Forget recent. The database automatically upgrades to schema 6, compresses caption vectors and builds derived title bundles; existing titles, transcripts and watch dates remain. No model/runtime rebuild or history re-import is needed when updating from v3.2.1. See [UPDATE-3.3.0.md](docs/UPDATE-3.3.0.md) for the tests and limitations.

Version 3.2 adds cached result paging, larger bounded database reads, protected storage, capture status/logs and optional imported-history retention. Updating from v2.13–v3.1 needs no runtime rebuild. Updating from v2.12 or earlier requires `pnpm run setup` for the bundled OCR runtime. The packaged ZIP already includes it. Database schema remains 5; updating from v3.1 requires no migration or re-import. Earlier versions receive the normalized-text upgrade documented in UPDATE-3.1.md. See [UPDATE-3.2.md](docs/UPDATE-3.2.md) for measurements and review decisions.

Storage protection adds the `unlimitedStorage` permission; site access remains optional and Recall's own content/image limits remain active. Storage & capture diagnostics shows approximate usage including model caches and the last 100 domain/reason events from this browser session. **Keep imported history** defaults to Forever. Choose 24 hours, 7 days, 4 weeks or 12 months only when you want older imported entries removed by original visit date, including imported transcripts. Export a backup first if you want to keep a separate copy.

## Enable websites and articles

Website capture starts off. In **Library & settings → Websites & articles**, enter a domain and click **Allow this site**, then approve the browser's optional site permission and refresh that site's tab. **Allow public websites** requests broader HTTP/HTTPS access only when you choose it. Use specific domains where possible: sensitive-page filtering cannot identify every private or signed-in page.

The same settings area imports extracted Takeout **Chrome/BrowserHistory.json** and **My Activity/Search** JSON files (up to 100 MB), or scans this browser's saved visits after optional history permission. Page titles, search queries and YouTube titles become searchable; old page bodies are not fetched. Keep settings open while importing. Pause preserves completed entries; importing again skips completed duplicates.

Live allowed pages save up to the first 2,000 visible words. Compatible visible HTML videos use native captions, sampled scenes and on-screen OCR. **Transcribe website video audio** is a separate off-by-default English-only option. Protected/cross-origin players, iframes, login walls and native social apps may not work. These techniques capture played portions, not an entire historical video. **Forget this site** blocks future capture and removes its saved entries. Use the popup site-pause button to pause website capture quickly.

Search **Everything**, or filter to **Videos**, **Pages** or **Searches**. Articles use text highlights when supported and the passage remains; website video time links need a matching player and the allowed page script. Feed URLs can be approximate. Full web content is capped at 2,000 items or 64 MiB of accounted text/vector payload, with older items retained as titles. Model memory and database overhead are additional.

For history imported earlier, click Fetch missing transcripts; no re-import is needed. Both Takeout imports and the browser-history Add all action attempt transcripts by default, with separate title-only checkboxes. Keep settings open until titles are saved and the background job starts. After that you can close settings, keeping the browser open. Fetching uses one separate minimized window with six muted player tabs at a time by default; choose three in Settings → Parallel videos to reduce load. Your main tab bar stays clear. Return to settings for progress or Pause after active videos. The window closes after completion or pause; closing it manually pauses new work. It is minimized, not fully hidden or closed, and may appear in the taskbar. An extension/browser restart can interrupt the job; retry missing transcripts afterward. See docs/UPDATE-2.7.md.

## Packaged installation or moving folders

After building the runtime, `pnpm run zip` creates recall-v3.3.0.zip. Extract it before using Load unpacked. A source ZIP from GitHub still needs `pnpm run setup`; it does not contain the generated runtime.

A different folder can mean a different extension identity. Export your old library through Library & settings → Export index before replacing or removing the old extension. Import that backup into the new installation. Avoid leaving both copies enabled on YouTube simultaneously.

## Optional history

New users can choose **Import history** or **Start empty**. Start empty adds no past data and requests no history access. The import option stays in settings for later.

To populate the library from a YouTube account export, use Google Takeout, select YouTube history in JSON format, extract the archive, and choose watch-history.json in Recall. JSON files up to 100 MB are accepted; HTML and ZIP files are not. The file is read locally and is not uploaded.

The saved titles, channels and watch dates support semantic title search immediately. Duplicate imports skip existing videos. Keep the settings page open while importing; if interrupted, import the same file again to skip completed entries. This does not automatically synchronize your Google account.

Alternatively, click Find YouTube history to scan this browser profile's saved visits. This requests optional history permission. Add all found videos saves the titles and then attempts transcripts for the newest 200 missing videos in the background by default. Uncheck Fetch transcripts when adding all videos for titles only, or select up to 20 videos for a smaller batch. The scan shows up to 500 recent unique videos and cannot recover deleted, incognito, or account-only activity from other devices.

## Transcript limitation

The user confirmed live caption capture and timestamp links work in their regular Edge session. Caption retrieval can still fail for particular videos or sessions. A normal YouTube video you are playing automatically falls back to English speech-to-text after captions fail. Reload the extension and refresh existing YouTube tabs to load the audio script. No recording button, microphone or tab-capture permission is required. The first speech use downloads a local model; model loading and recognition use extra CPU. Watch the popup's Speech-to-text status or use Stop. The automatic fallback has an off switch in settings. Mixed/non-English uploaded subtitle tracks without original-audio/ASR evidence do not trigger it. Manual Start English transcription bypasses the language guard when you know the label is wrong; the model remains English-only.

Speech-to-text captures only portions played after it starts, one video at a time. It skips detected ads and paused playback, splits at seeks/rate changes, labels results as partial AI speech, and can make recognition/timing errors. Unavailable or protected player audio can still fail. The background imported-history queue continues fetching captions; it does not silently play entire histories through speech recognition. Audio stays in memory on this device; saved speech text follows the same retention as other transcripts. See docs/UPDATE-2.8.md.

Index backup restore now sends one video or image per request and shows durable progress. Keep settings open; closing it stops further batches. Completed items remain saved. Library changes reserve exclusive access, cancel pending frame saves and wait for current visual queries/warmup. Conflicting restore/delete/clear operations report a clear error. Stop active speech-to-text and pause caption fetching before restoring; errors are not silently retried. The restore still re-embeds each video for model compatibility; a single unusually large transcript can still take time.

## Data retention

With Keep imported history set to Forever, imported history stays protected after background transcript fetching, even when full transcripts are saved. New imports carry their origin; after watching a video, the retention setting applies even if only scenes were captured. Legacy title-only records with scenes also expire; legacy records without origin information or scenes keep the import exemption to avoid deleting old imports. For videos you actually watch, retention applies to the latest watch or indexing date. Rewatching an already indexed video updates recency without re-embedding it. Background Add transcript preserves import protection and does not pretend the video was rewatched today. If v2.11 or an earlier version lost an imported flag, re-import the same Takeout file: an exact original watch-date match repairs a missing flag without replacing transcript text. Explicit watched flags and newer watch dates are not changed; already deleted records cannot be recovered without the source file or a backup.

Model downloads and thumbnail requests use the network. Transcripts, vectors and settings live in the current browser profile. Uninstalling or switching profiles does not transfer that library automatically; export a backup first.

## New controls

Select **Search this video** on an active video to restrict results; Recall tries Index first if needed. **Copy link** shares its time. Type `rc` plus Space/Tab in the browser address bar to search your saved library. An empty popup offers optional **Try sample videos**; they are original demo clips and do not fetch YouTube.

**Lite mode** pauses scene, on-screen text and speech capture together. Expand Speech-to-text in the popup for its manual controls. **Forget recent** in Your data removes whole items using their Recall save date, including recent imports; its confirmation explains the deletion. The suggested last-week chip only changes a filter after you click it. New text is heuristically redacted; captured images are not. Site allowlists and exclusions remain recommended for private browsing contexts.
