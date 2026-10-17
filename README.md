# Recall — SwampHacks XII

Recall helps you find a YouTube video from a vague memory and jump to the matching moment. Version **2.11.0** reduces weak visual matches, filters speech noise, fixes watched-video retention and repeat visits, and opens the shown match with Enter. Titles, captions, audio and scenes remain in one search. See [the update](docs/UPDATE-2.11.md) and [the ma-copy review](docs/MA-COPY-REVIEW.md).

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

- Watch a YouTube video. Recall tries captions after the configured watch delay; if that fails, it automatically starts English speech-to-text on the playing video's audio. Known non-English audio metadata skips the English-only fallback. No recording button or microphone permission is needed. First use downloads another model and uses extra CPU. The popup shows progress, **Stop**, and an optional retry. Disable automatic speech-to-text in settings.
- Describe what you remember in the popup. By default, Recall shows the strongest matching video and its matching moment. Use **→** and **←** to browse different videos in ranked order across the whole matching library. Uncheck **One video at a time** for the list view, which shows up to 12 results with the configured maximum per video. The view choice is remembered. Press Enter in the search box to open the shown match; if the query changed, Recall searches it first and opens the fresh match. Ctrl/Cmd+Enter opens it in the background.
- The same search also checks sampled video images, even if nobody describes the scene aloud. Result indicators show **Scene**, **Transcript**, **Audio**, or **Title**; nearby scene/transcript evidence can appear together. Audio means AI transcription of player audio. Scene matches show the saved image and link to its timestamp. There is no separate scene-search mode.
- Searches are independent by default. Click **Refine** beside the search box to add more clues to the current query. Edit those clues to build on the original search. Changing the main query, closing Refine, or reopening the popup clears extra clues.
- Optionally import the extracted Google Takeout `watch-history.json`, up to 100 MB. Recall saves titles first, then attempts available transcripts in a separate minimized Recall window. Uncheck **Fetch transcripts after import** for titles only.
- Use **Fetch missing transcripts** for already imported titles. Fetching runs in the background with six muted videos at once in that separate minimized window (choose three in Settings → Parallel videos to reduce load). Once the titles are saved and fetching starts, you can close settings; keep the browser open. Return to settings for progress or **Pause after active videos**. Large or blocked histories can still take time.
- **Find videos visited in this browser** scans this browser profile's history. **Add all found videos to Recall** now attempts available transcripts automatically, unless its transcript checkbox is unchecked. Videos already indexed are skipped; failures keep their titles.

YouTube may not provide captions for every video or session. The automatic speech fallback saves only audio played after it starts; it cannot recover unwatched portions or past audio from history. It runs for one normal watched video at a time, independently of the background caption-import queue. Results are labeled **AI speech · played portions**, with approximate timestamps and possible recognition errors. Full captions replace partial speech results if later retrieved. Unsupported or protected players may block audio capture. Imported videos still attempt captions only; unavailable captions keep the title searchable. See [UPDATE-2.8.md](docs/UPDATE-2.8.md) and [the test report](docs/TEST-REPORT.md).

The MiniLM search model and Whisper tiny.en speech model run locally using the bundled Transformers.js runtime. First use downloads weights from Hugging Face. Video audio is processed in memory, never uploaded or saved as an audio file. Captions and thumbnails come from YouTube; transcript fetching sends video requests to YouTube. The transcript text, index and settings stay in your browser profile. Unwatched imported title-only entries stay until deleted. Watching them, or saving a scene-only entry, makes them subject to watched-video retention alongside transcripts and partial speech.

Scene capture is on by default and can be switched off with **Save scene snapshots** in settings. It saves a small JPEG from the visible playing video about every 20 seconds after the watch delay, excluding detected ads, pauses and background history-capture tabs. It samples watched portions rather than whole videos, so brief scenes, actions between snapshots and protected/unreadable media can be missed. Existing history has no scene images until you watch those videos. CLIP compares English visual descriptions to the snapshots locally; its first use downloads extra weights and adds CPU/memory work. Images stay on this device, with a cap of 120 per video and 1,000 total; oldest images are removed first. Snapshot age follows the transcript-retention setting. Deleting a video removes its snapshots, and index backups include them. See [UPDATE-2.9.md](docs/UPDATE-2.9.md).

Transcript fetching uses YouTube's normal player/session in one separate minimized window, keeping its capture tabs out of your main tab bar. The window must stay open while fetching; it closes after completion or pause. Closing it yourself pauses new work. It remains visible in the taskbar and can be restored; browsers do not support a closed window that keeps running. Existing YouTube restrictions still apply. Reloading the extension or restarting the browser can interrupt a job; retry **Fetch missing transcripts** afterward. See [UPDATE-2.7.md](docs/UPDATE-2.7.md).

Backup restores send one video or image per request with progress; keep the settings page open. Release notes, model comparisons and live-test reports are in [`docs/`](docs/).

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

Open a pull request on GitHub. After it is merged, teammates pull the latest code and reload Recall. Refresh YouTube tabs after content-script changes. Run `pnpm run setup` again after dependency or runtime-build changes.

GitHub changes do not automatically update installed extensions. Load your checkout directly for development, keep its folder path stable, and reload after editing. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Project layout

| Path | Purpose |
| --- | --- |
| `manifest.json`, `background.js` | Extension configuration and service worker |
| `content/` | YouTube captions, playback timing, player audio and sampled frames |
| `offscreen/`, `lib/` | Local search/speech/vision models, bounded queues, IndexedDB and evidence ranking |
| `popup/`, `options/`, `styles/` | Search popup and library/settings interface |
| `scripts/` | Runtime build and ZIP packaging |
| `tests/` | Unit tests and isolated browser regressions |
| `docs/` | Release notes, reviews, evaluations and live-test reports |
| `licenses/` | Third-party runtime license notices |

Run `pnpm run zip` after setup to make a loadable `recall-v2.11.zip` including the generated runtime. ZIP files, dependencies, model weights, history exports, browser profiles and build metadata should not be committed.

Third-party notices are included. Existing native Node dependency audit findings and their browser-bundle reachability limits are documented in [TEST-REPORT.md](docs/TEST-REPORT.md); the dependency graph is not audit-clean. No project-wide open-source license has been selected.
