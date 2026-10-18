# Recall — SwampHacks XII

Recall helps you find something you watched or read from a vague memory. Version **3.3.1** applies the supplied minimal UI: a search-first popup, yellow moment highlights, teal controls, and a sidebar library with expandable settings. It retains all v3.3.0 search, capture, privacy and storage improvements. Current-video scope, copy links, samples, query consent, Light mode and recent-item deletion remain accessible. See [the UI update](docs/UPDATE-3.3.1.md), [the v3.3.0 behavior and measurements](docs/UPDATE-3.3.0.md), and [the test report](docs/TEST-REPORT.md).

## Team setup

Install Node.js 22 or newer and pnpm **11.25.0**, then:

```sh
git clone https://github.com/eric-chenCS/SwampHacks-XII.git
cd SwampHacks-XII
pnpm install --frozen-lockfile --ignore-scripts
pnpm run vendor
pnpm test
```

Setup installs the locked dependencies with install scripts disabled, then builds the browser runtime into `vendor/`. That generated directory is excluded from Git; **build it before loading the extension**.

Open `edge://extensions` or `chrome://extensions`, enable Developer mode, click **Load unpacked**, and select this repository's root folder (the folder with `manifest.json`). No personal YouTube API key is needed.

If switching from a different installed folder, export your library first and import that backup into the new installation. A new folder can create a separate extension identity. Avoid enabling two copies on YouTube at once.

## Use

- Open **Library & settings → Websites & articles** to enable live website capture. Enter a specific domain and click **Allow this site**, or explicitly choose **Allow public websites** for broader access. Website capture starts off; site permission is optional. Refresh existing tabs after granting access. Recall saves visible text from allowed pages, up to the first 2,000 words. Use the popup's site pause button or **Forget this site** in settings to stop capture and remove that site's saved entries.
- Import extracted Takeout **Chrome/BrowserHistory.json** or **My Activity/Search** JSON through the general-history card, or scan this browser's saved history. Imported pages save titles and visits; Google queries are included only when **Save Google search queries** is enabled (off by default). YouTube links save video titles. Imports do not retrieve old page bodies or video audio. Use the existing YouTube transcript tools for imported YouTube videos. Files stay local; keep settings open during import. A visit does not establish that you read or watched something.
- On allowed sites, compatible visible HTML video players can contribute played native captions, sampled scenes and burned-in text. Enable **Transcribe website video audio** separately to try local English speech recognition when usable captions are unavailable. It starts off to limit CPU use and runs on one player at a time. Instagram/TikTok browser pages may work when they expose a usable player; login walls, protected or cross-origin media, embedded frames and native mobile apps are not covered. Feed links may reopen the feed rather than the exact clip. These are sampled played portions, not complete downloads.
- Use **Everything / Videos / Pages / Searches** above the results to narrow the shared search. Page matches open a text-fragment link where supported and where the passage still exists. Website video timestamps require the allowed Recall page script and a matching usable player.
- The popup shows the current website's capture status, **Save this page now** and **Forget and block site**. Library & settings includes approximate storage usage and a session-only log of the last 100 domains/reason codes. It records no full URLs or page/query text. **Keep imported history** defaults to Forever; choosing 90 days or 1 year removes older imports using their original visit dates. Export a backup first if you want a copy.
- Watch a YouTube video. Recall tries captions after the configured watch delay; if that fails, it automatically starts English speech-to-text on the playing video's audio. Known non-English audio and mixed uploaded subtitle languages skip the English-only automatic fallback. The popup’s Start English transcription button can override incorrect language metadata. No recording button or microphone permission is needed. First use downloads another model and uses extra CPU. The popup shows progress, **Stop**, and an optional retry. Disable automatic speech-to-text in settings.
- Describe what you remember in the popup. By default, Recall shows the strongest matching video and its matching moment. Use **→** and **←** to browse different videos in ranked order across the whole matching library. Uncheck **One video at a time** for the list view, which shows up to 12 results with the configured maximum per video. The view choice is remembered. Press Enter in the search box to open the shown match; if the query changed, Recall searches it first and opens the fresh match. Ctrl/Cmd+Enter opens it in the background.
- The same search also checks sampled video images, even if nobody describes the scene aloud. Result indicators show **Scene**, **Transcript**, **Audio**, **On-screen text**, or **Title**; nearby scene/transcript evidence can appear together. Audio means AI transcription of player audio. Scene matches show the saved image and link to its timestamp. There is no separate scene-search mode.
- Searches are independent by default. Click **Refine** beside the search box to add more clues to the current query. Edit those clues to build on the original search. Changing the main query, closing Refine, or reopening the popup clears extra clues.
- Optionally import the extracted Google Takeout `watch-history.json`, up to 100 MB. Recall saves all titles first, then attempts available transcripts for the newest 200 missing videos in a separate minimized Recall window. Use **Fetch missing transcripts** to fetch more manually. Uncheck **Fetch transcripts after import** for titles only.
- Use **Fetch missing transcripts** for already imported titles. Fetching runs in the background with six muted videos at once in that separate minimized window (choose three in Settings → Parallel videos to reduce load). Once the titles are saved and fetching starts, you can close settings; keep the browser open. Return to settings for progress or **Pause after active videos**. Large or blocked histories can still take time.
- **Find videos visited in this browser** scans this browser profile's history. **Add all found videos to Recall** attempts available transcripts for the newest 200 missing videos automatically, unless its transcript checkbox is unchecked. Videos already indexed are skipped; failures keep their titles.

- On a current video, choose **Search this video** to restrict all result indicators to that video. If its captions are not indexed, Recall first tries **Index**. Caption failure shows a retry message; live audio/OCR still require playback and their usual settings.
- **Copy link** copies the result's exact video time or article passage. Enter `rc`, then Space/Tab, in the address bar to search Recall; selecting a suggestion opens that saved source.
- An empty popup offers **Try sample videos**: five small, original, silent animated videos with authored captions, labelled Recall samples. They play locally with timestamp links, can be deleted or exported, and are never automatically added. First sample indexing still needs the text model download.
- The toolbar dot and popup explain capture status. **Light mode** in Settings stops scene/OCR/speech capture together while keeping captions and articles. Existing scene evidence is still searchable and can load its model. Expand **Speech-to-text** in the popup for manual controls.
- **Your data → Forget recent** removes whole items saved or updated by Recall in the last hour, day or week, including newly imported history with old visit dates. A suggested **Only last week?** chip changes search dates only when you click it.
- Queries use a separate local worker and pass background work at four-text batch boundaries. The text worker unloads after five minutes idle; the popup preloads it for an existing library. Searches show **Retry** after ten seconds. Saves can finish from an existing snapshot; delete, clear, site forget, retention cleanup and restore invalidate snapshots strictly.

The resident video matrix uses 8-bit vectors, up to 100,000 caption/title rows from recent content (up to 1,000 full-transcript videos), plus the existing bounded OCR rows. Older transcripts remain on disk and are searched in bounded batches when necessary, so very large video libraries can take longer. Title bundles accelerate website history reads without limiting exact-word matches to a semantic shortlist. The database upgrades automatically from v3.2.1; keep the same extension folder and export a backup before switching installations.

Website capture blocks known personal services and private entry routes, including messaging, grades, payslips, orders and vaults. Visible Sign out controls stop capture. Recognizable emails, formatted phone numbers, SSNs and checksum-valid card numbers are redacted from newly saved text; URLs containing those patterns are skipped. Query capture/import is separately off by default, and obvious medical Google queries remain excluded. These heuristics cannot identify every private page or redact video images. Use a site allowlist for tighter control; existing saved items are not silently rewritten by the new privacy rules.

YouTube may not provide captions for every video or session. The automatic speech fallback saves only audio played after it starts; it cannot recover unwatched portions or past audio from history. It runs for one normal watched video at a time, independently of the background caption-import queue. Results are labeled **AI speech · played portions**, with approximate timestamps and possible recognition errors. Full captions replace partial speech results if later retrieved. Unsupported or protected players may block audio capture. Imported videos still attempt captions only; unavailable captions keep the title searchable. See [UPDATE-2.8.md](docs/UPDATE-2.8.md) and [the test report](docs/TEST-REPORT.md).

The MiniLM search model and Whisper tiny.en speech model run locally using the bundled Transformers.js runtime. First use downloads weights from Hugging Face. Video audio is processed in memory, never uploaded or saved as an audio file. Captions and thumbnails come from YouTube; transcript fetching sends video requests to YouTube. The transcript text, index and settings stay in your browser profile. With the default Forever setting, imported entries stay protected after background captions are fetched, regardless of whether they have transcripts. Watching them, or saving a scene-only entry, makes them subject to watched-video retention alongside transcripts and partial speech.

Scene capture is on by default and can be switched off with **Save scene snapshots** in settings. After the watch delay, it checks a tiny version of the visible playing video twice a second. Noticeable changes can trigger extra small JPEG snapshots; quiet footage stretches routine snapshots from about 20 to 60 seconds. Detected ads, pauses, hidden players and background history-capture tabs are excluded. Processing is bounded: one request and one waiting frame per player, at least two seconds between requests, and up to six extra processing attempts per rolling minute across Recall. Busy work can delay or drop frames. This samples watched portions, so very brief/small events, actions between checks and protected media can still be missed. Existing history has no scenes until you watch those videos. CLIP compares English visual descriptions to the snapshots locally; its first use downloads weights and adds CPU/memory work. Images stay on this device, capped at 240 per video, 2,000 total, and a 24 MiB compressed-image/vector budget; oldest images are removed first. Active footage can reach these limits sooner. Search reads vectors without decoding every image. Retention and deletion include snapshots; backups preserve extra frames and their original timestamps. See [UPDATE-2.15.md](docs/UPDATE-2.15.md).

**Read on-screen text** is also on by default, with its own setting. It samples a temporary JPEG up to 1280 × 720 about every five seconds of visible playback, reads English subtitles and other text in the pixels using bundled Tesseract OCR, then discards the sharp image. Words join the same MiniLM search with an **On-screen text** indicator and an approximate sample timestamp. Low-confidence fragments and exact repeated nearby lines are filtered, including persistent watermarks alongside new captions. Changes in numbers, negation or word order remain searchable. Playback links open three seconds before an OCR observation, while the original sample timestamp remains stored. This uses extra CPU; one frame runs at a time, unchanged sharp pixels skip one recognition cycle but are rechecked within 10 seconds, busy frames are skipped, and the OCR worker releases after 60 seconds idle. Brief, small, stylized, low-contrast or non-English text can be missed or misread. It does not backfill old snapshots or imported history. Saved OCR text is capped at 720 moments per video and 10,000 total, follows retention, and is included in backups. No external OCR service, API key, microphone or new browser permission is used.

Transcript fetching uses YouTube's normal player/session in one separate minimized window, keeping its capture tabs out of your main tab bar. The window must stay open while fetching; it closes after completion or pause. Closing it yourself pauses new work. It remains visible in the taskbar and can be restored; browsers do not support a closed window that keeps running. Existing YouTube restrictions still apply. Reloading the extension or restarting the browser can interrupt a job; retry **Fetch missing transcripts** afterward. See [UPDATE-2.7.md](docs/UPDATE-2.7.md).

Backup restores send one video or image per request and up to 16 OCR text moments per batch with progress and hold live visual capture while waiting for in-flight frames, searches and warmup; keep the settings page open. Stop active speech-to-text and pause transcript fetching before restoring or deleting data. Concurrent library mutations are refused until the current action finishes. Indexing completion/failure rows show the video title when available and fade after five seconds; overall job counts remain. If an older release lost import protection, re-import the original Takeout file to repair matching watch dates without replacing transcripts. Release notes, model comparisons and live-test reports are in [`docs/`](docs/).

## Edit and share changes

On the first use after updating from an older release, Recall improves existing text embeddings in background batches. The popup shows progress and search stays available. It preserves transcripts, dates, audio ranges and scene images; no re-import is needed. Passage vectors now describe the actual spoken text, with title/channel context ranked separately. Exact phrases and Unicode word matching supplement semantic similarity. Result scores are ranking signals, not probabilities, so the popup shows evidence indicators instead of percentages. The fixed 31-query synthetic comparison improved correct first moments from 29 to 31; this is a regression check, not a general accuracy guarantee. Larger BGE and Whisper base models tied the existing models on the narrow fixtures, so MiniLM, Whisper tiny.en and CLIP remain the shipped models.

Use a branch and pull request for team changes:

```sh
git pull --ff-only
git switch -c your-change
# Edit the source files.
pnpm test
git add .
git commit -m "Describe the change"
git push -u origin your-change
```

Open a pull request on GitHub. After it is merged, teammates pull the latest code and reload Recall. Refresh YouTube and allowed website tabs after content-script changes. Run `pnpm run setup` again after dependency or runtime-build changes.

GitHub changes do not automatically update installed extensions. Load your checkout directly for development, keep its folder path stable, and reload after editing. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Project layout

| Path | Purpose |
| --- | --- |
| `manifest.json`, `background.js` | Extension configuration and service worker |
| `content/` | YouTube and optional website text, video captions, playback timing, audio and sampled frames |
| `offscreen/`, `lib/` | Local search/speech/vision models, bounded queues, IndexedDB and evidence ranking |
| `popup/`, `options/`, `styles/` | Search popup and library/settings interface |
| `scripts/` | Runtime build and ZIP packaging |
| `tests/` | Unit tests and isolated browser regressions |
| `docs/` | Release notes, reviews, evaluations and live-test reports |
| `licenses/` | Third-party runtime license notices |

Run `pnpm run zip` after setup to make a loadable `recall-v3.3.0.zip` including the generated runtime. ZIP files, dependencies, downloaded Hugging Face model caches, history exports, browser profiles and build metadata should not be committed.

Website capture skips incognito, visible password fields, pages dominated by editors, known sensitive domains, private entry routes, and blocked domains. Ordinary deep article/code paths, hidden login forms and small comment boxes no longer block a public page; form/editor contents are excluded. This is a conservative filter, not universal detection of signed-in or private content; prefer specific allowed domains. Website audio remains off until enabled. Old pages are never fetched to fill history. Web vectors use 8-bit storage and searches scan bounded batches with cached normalized text. Automatic recapture waits at least 60 seconds and reuses unchanged passage vectors. Full web content is capped at 2,000 items or 64 MiB of accounted text, normalized text and vector payload; older content falls back to its searchable title. Imported metadata uses the separate Keep imported history setting until read live, after which normal retention applies. These budgets do not include all browser database overhead or model memory.

Third-party notices are included. Existing native Node dependency audit findings and their browser-bundle reachability limits are documented in [TEST-REPORT.md](docs/TEST-REPORT.md); the dependency graph is not audit-clean. No project-wide open-source license has been selected.
