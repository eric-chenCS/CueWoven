# CueWoven

**Find what you watched or read—even when you only remember a detail.**

Browser history remembers URLs. CueWoven helps you remember what was in them. Describe a quote, idea or scene to find a saved video moment or article passage, then jump back to the source.

Built for SwampHacks XII as a local-first Chrome and Microsoft Edge extension. No personal YouTube API key is required.

[Download CueWoven](https://github.com/eric-chenCS/SwampHacks-XII/releases/latest) · [Installation guide](INSTALL.md) · [User guide](docs/USAGE.md) · [For developers](CONTRIBUTING.md)

<img src="docs/assets/search-demo.png" width="440" alt="CueWoven finds a timestamped battery explanation from a natural-language query, using an original demo video." />

*Actual extension UI with original sample content, not personal browsing history.*

## Install and try it

1. Open the [latest release](https://github.com/eric-chenCS/SwampHacks-XII/releases/latest) and download the **cuewoven-v3.3.30.zip** asset. Extract it to a permanent folder.
2. Open `chrome://extensions` or `edge://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
4. Open CueWoven from the toolbar. Choose **Try sample videos** for a quick demo, or watch a YouTube video to start your own library.

Try searching **“why does a phone battery hold less charge as it ages”** with the samples. Press **Enter** to show matches. First use downloads the local search model, so allow time for setup. Click the result to open the matching moment.

The release ZIP includes the browser runtime. GitHub's **Code → Download ZIP** is source code and needs the [developer build steps](CONTRIBUTING.md#build-from-source) before loading. CueWoven is currently installed as an unpacked extension, not through a browser store.

## What you can find

- **Video moments:** search captions, played English speech, sampled scenes and on-screen text. Open a timestamp link or copy it to share.
- **Articles and pages:** search saved text, visible images and image captions on websites you allow. Open a matching passage where text highlighting is supported.
- **Bring a specific video:** paste YouTube links to index available captions. Export a CueWoven backup to take your saved library to another installation.
- **More precise results:** refine a query, filter by source or date, search inside the current YouTube video, and use ← / → to browse ranked matches.

YouTube is the only default site. Under **Library & settings → Websites**, add suggested sites or individual domains and grant browser access. Compatible browser video players on other sites can contribute content; native mobile apps, login walls and protected players are not supported.

## How it works

1. **Capture:** allowed pages and videos contribute text and selected visual evidence while you browse. Backup restore brings back previously saved evidence.
2. **Index on your device:** MiniLM turns passages into semantic vectors; exact words, titles and context also contribute to ranking. Whisper handles English speech fallback, CLIP compares images and scenes, and Tesseract reads on-screen text.
3. **Recall the source:** your description is compared with saved evidence. Results show why they matched and link to a video moment or page passage.

Semantic search can match related meaning rather than identical words. Rankings are estimates, not probabilities or guaranteed identification. [Architecture and model details →](docs/ARCHITECTURE.md)

## Privacy and practical limits

Your library and search index stay in the current browser profile. CueWoven does not upload your history, queries, transcripts or captured audio to an AI service. Model weights download on first use; websites and YouTube still receive normal content requests. Optional site access is requested when you add websites. CueWoven does not request browser-history permission.

Pause saving, exclude sites, choose retention periods, export a backup or delete saved items in settings. Uninstalling or clearing the profile can erase the library. Backups preserve saved evidence, not original video files or complete websites. Live Google-search capture and website audio transcription start off. Sensitive-page filters and text redaction help, but cannot recognize every private page or redact captured images. [Privacy and data controls →](docs/USAGE.md#privacy-and-data)

Live capture covers played or read portions. It cannot recover unwatched audio, guarantee every brief scene, or retrieve captions that YouTube does not provide. It does not scan your past browser visits or import Google Takeout files. Models use CPU and memory; **Lite mode** keeps text capture while pausing new image, scene, OCR and speech capture.

## Build and contribute

```sh
git clone https://github.com/eric-chenCS/SwampHacks-XII.git
cd SwampHacks-XII
pnpm install --frozen-lockfile --ignore-scripts
pnpm run vendor
pnpm test
```

Requires Node.js 22+ and pnpm 11.25.0. Load this folder as an unpacked extension after building. See [CONTRIBUTING.md](CONTRIBUTING.md) for branches, browser tests and packaging.

The current unit suite has **277 tests**. Isolated browser checks cover search, capture, backups, permissions and the interface. Controlled fixtures are regression checks, not a guarantee of real-world retrieval accuracy. [Validation and technical documentation →](docs/README.md)
