# Install WebLapse

WebLapse runs in desktop Chrome and Microsoft Edge (Chromium 116 or newer). It is currently distributed as an unpacked extension.

## Download and load

1. Open [Releases](https://github.com/eric-chenCS/SwampHacks-XII/releases/latest).
2. Download **weblapse-v3.3.21.zip** under Assets. Extract it into a permanent folder.
3. Open `chrome://extensions` or `edge://extensions`.
4. Enable **Developer mode**, click **Load unpacked**, and select the extracted folder containing `manifest.json`.
5. Pin WebLapse in the browser's extensions menu if you want quick toolbar access.

Load the extracted folder, not the ZIP. The release asset includes its runtime; GitHub's automatically generated source ZIP does not. To use a clone or source ZIP, follow [Build from source](CONTRIBUTING.md#build-from-source).

## First search

Open WebLapse from its toolbar icon and choose **Try sample videos**. The five original demos let you search before collecting any history. Try “why does a phone battery hold less charge as it ages”. Initial model loading requires internet access and may take a little time.

To start your own library, play a YouTube video. After the watch delay, WebLapse attempts available captions and can collect played speech or visual evidence according to your settings. Open the popup and describe what you remember.

**Ctrl+Shift+F** opens the popup when the browser shortcut is available. If another extension or app claims it, set WebLapse's shortcut at `chrome://extensions/shortcuts` or `edge://extensions/shortcuts`, or use the toolbar icon.

## Add websites or past history

YouTube is included by default. In **Library & settings → Websites**, click **Add suggested sites** or **Add site**, approve browser access and refresh an already-open page. Denied permission leaves the list unchanged.

In **Add history**, import extracted Google Takeout JSON or find visits saved by this browser. Importing is optional. [Supported formats and transcript fetching](docs/USAGE.md#bring-your-past-history).

## Update without losing your library

Keep using the same installed folder. Export a backup under **Your data**, replace that folder's files with the new release's contents, click **Reload** in the browser's extension manager, and refresh open video/website tabs.

Moving to another folder or browser profile may create a separate extension identity. Export your library before uninstalling or switching, then import the backup into the new installation. Avoid running two copies at once.

Unpacked extensions do not update automatically from GitHub. If you loaded a Git checkout, pull merged changes and reload; rebuild the runtime when its dependencies or build files change.

## If something does not work

- **Empty library:** try the samples, watch a video or import history. Imports initially provide titles, not past page content.
- **No website capture:** check Save automatically, the site's listing and browser permission; refresh the page after enabling access. Private-page filters can intentionally skip a page.
- **No transcript:** captions may be unavailable. Live English speech fallback needs playback and cannot recover audio from before it started.
- **Slow first search:** allow the model download to finish. Reduce capture load with Lite mode or fewer parallel transcript fetches.
- **Model download fails:** check internet access and the popup's model status, then retry. A title import alone does not avoid the initial search-model download.

[User guide](docs/USAGE.md) · [Developer guide](CONTRIBUTING.md)
