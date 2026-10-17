# Recall — SwampHacks XII

Recall helps you find a YouTube video from a vague memory and jump to the matching transcript moment. Version **2.1.0** supports optional history import, automatic transcript fetching, and local semantic search.

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

- Watch a captioned YouTube video, or open Recall and choose **Index this video now**.
- Describe what you remember in the popup. Transcript results link to the matching second. Search compares your saved library and shows up to 12 results, with the configured maximum per video.
- Optionally import the extracted Google Takeout `watch-history.json`, up to 100 MB. Recall saves titles first, then attempts available transcripts in muted background tabs. Uncheck **Fetch transcripts after import** for titles only.
- Use **Fetch missing transcripts** for already imported titles. Keep Library & settings open. You can pause after the current video and retry missing transcripts later. Large histories can take hours.
- **Find videos visited in this browser** scans this browser profile's history, rather than a YouTube account export.

YouTube may not provide a transcript for every video or session. Failed attempts keep the title searchable. Title-only results open the video without a timestamp. The project owner confirmed live capture in their normal Edge session; isolated test browsers received empty captions even without Recall. See [the test report](TEST-REPORT.md).

The embedding model runs locally. First use downloads weights from Hugging Face. Captions and thumbnails come from YouTube; transcript fetching sends video requests to YouTube. The index and settings stay in your browser profile. Imported title-only entries stay until deleted; transcripts follow the configured retention period.

## Edit and share changes

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
| `content/` | YouTube caption capture and bridge |
| `offscreen/`, `lib/` | Local embedding model, IndexedDB, parsing and ranking |
| `popup/`, `options/`, `styles/` | Search popup and library/settings interface |
| `scripts/` | Runtime build and ZIP packaging |
| `tests/` | Unit tests and optional controlled browser test |
| `licenses/` | Third-party runtime license notices |

Run `pnpm run zip` after setup to make a loadable `recall-v2.1.zip` including the generated runtime. ZIP files, dependencies, model weights, history exports, browser profiles and build metadata should not be committed.

Third-party notices are included. Existing native Node dependency audit findings and their browser-bundle reachability limits are documented in [TEST-REPORT.md](TEST-REPORT.md); the dependency graph is not audit-clean. No project-wide open-source license has been selected.
