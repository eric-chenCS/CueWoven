# Install CueWoven

CueWoven runs in desktop Chrome and Microsoft Edge. The manifest requires Chromium 116 or newer; use an up-to-date browser. This installation method is for desktop browsers, not Safari or mobile browsers. CueWoven is currently distributed as an unpacked extension, and the ready-to-use release ZIP does not require Node.js, pnpm or terminal commands.

## Download and load

1. Open [Releases](https://github.com/eric-chenCS/CueWoven/releases/latest) and expand **Assets** if needed.
2. Download the named installation asset, currently **cuewoven-v3.3.35.zip**. Do not choose **Source code (zip)**, **Source code (tar.gz)** or **Code → Download ZIP** for a ready-to-use installation.
3. Extract the **entire ZIP** into a permanent folder. On Windows, right-click the ZIP and choose **Extract All**. Do not load from the ZIP preview or copy only `manifest.json`.
4. In Chrome, open `chrome://extensions`; in Edge, open `edge://extensions`.
5. Enable **Developer mode**, click **Load unpacked**, and select the folder that directly contains `manifest.json`. If extraction created an outer folder, open it and select the inner extension folder.
6. Confirm CueWoven appears and is enabled. Refresh any YouTube or website tabs that were open before installation, then open CueWoven from the extensions menu. Pin it if you want quick toolbar access.

The selected folder must contain both `manifest.json` and `vendor/`. The runtime includes `vendor/transformers.bundle.js`, the ONNX `.mjs` and `.wasm` files, and the OCR files under `vendor/ocr/`, including `ocr.bundle.js`, `worker.min.js` and `eng.traineddata.gz`. Keep the whole folder in place after loading it.

GitHub source downloads and clones omit generated runtime files. If you deliberately use source code, complete [Build from source](CONTRIBUTING.md#build-from-source) before loading it.

## First search

Open CueWoven from its toolbar icon and choose **Try sample videos**. The five original demos let you search before collecting any history. Try “why does a phone battery hold less charge as it ages”, then press **Enter**. Initial model loading requires internet access and may take a little time.

To test saving, use a normal, non-InPrivate/non-incognito window. Check **Library & settings → Settings → Save automatically**, then play a YouTube video in the visible tab. The default watch delay is 20 seconds for longer videos and up to 5 seconds for short videos; model setup and processing can take additional time. CueWoven attempts available captions and can collect played speech or visual evidence according to your settings. A saved title can appear before transcript processing finishes. Open the popup and describe what you remember.

**Ctrl+Shift+F** on Windows/Linux or **Command+Shift+K** on macOS opens the popup when the browser shortcut is available. If another extension or app claims it, set CueWoven's shortcut at `chrome://extensions/shortcuts` or `edge://extensions/shortcuts`, or use the toolbar icon.

## Add websites

YouTube is included by default. In **Library & settings → Websites**, click **Add suggested sites** or **Add site**, approve browser access and refresh an already-open page. Denied permission leaves the list unchanged. Browser-level site access must also allow CueWoven on YouTube and each site you choose. In Edge, open CueWoven's **Details → Site access** from `edge://extensions` and check the affected site; access restricted to a click can prevent automatic capture. [Microsoft's site-access instructions](https://support.microsoft.com/en-us/edge/microsoft-edge-extensions-frequently-asked-questions).

Videos are saved as you watch them. Past browser visits and Google Takeout imports are not supported. To move an existing CueWoven library, use **Your data → Export backup / Restore backup**. [What a backup contains](docs/USAGE.md#privacy-and-data).

## Update without losing your library

Keep using the same installed folder. Export a backup under **Your data**, replace that folder's files with the new release's contents, click **Reload** in the browser's extension manager, and refresh open video/website tabs.

The library, model cache, settings and site permissions belong to the current browser profile and do not automatically transfer to another computer. Export a backup on the old computer, install the complete release on the new one, allow its models to download, and restore the backup. Configure site access again; backups do not contain settings or browser permissions.

Moving to another folder or browser profile may create a separate extension identity. Export your library before uninstalling or switching, then import the backup into the new installation. Avoid running two copies at once.

Unpacked extensions do not update automatically from GitHub. If you loaded a Git checkout, pull merged changes and reload; rebuild the runtime when its dependencies or build files change.

## If something does not work

| Symptom | Check |
| --- | --- |
| Cannot find **Load unpacked** | Enable Developer mode on the browser's extensions page. A managed work/school browser may restrict developer extensions. |
| Manifest missing or extension cannot load | Fully extract the installation ZIP and select the folder containing `manifest.json`, not its parent folder or the ZIP itself. |
| **Failed to fetch dynamically imported module** / on-screen text cannot be saved | Copy the full error, including its URL. Check that the referenced local file exists in the extracted folder and that the complete `vendor/` directory is present. Update the same folder from the named release ZIP, reload CueWoven, close/reopen its popup or settings, and refresh the video/page tab. If it persists, report the full error, version and browser version; this message alone does not establish whether a file is missing or a browser request was blocked. |
| Nothing saves | Confirm CueWoven and **Save automatically** are enabled, the tab is visible, and the browser permits site access. Refresh pages after installation/reload and wait for the watch/reading delay and model setup. Incognito/InPrivate capture is excluded. |
| YouTube saves, other sites do not | Add the site under **Websites**, approve browser permission, confirm site saving is not paused, and refresh the page. Private-page filters can intentionally skip a page. |
| Saved title but no transcript | Captions may be unavailable. English speech fallback needs compatible playback and cannot recover earlier audio; missing or undetermined language metadata permits an automatic English attempt, while known non-English audio is skipped. Check **Settings → Transcribe when there are no captions**. |
| Empty library on a new computer | Try the samples or collect new content. Use Export/Restore backup to transfer saved evidence; the library does not sync automatically. |
| Slow first search / model download fails | Allow model setup to finish and check the popup's model status and connection. Restoring a backup also needs the search model. Lite mode reduces new capture load. |

For capture reasons, open **Library & settings → Your data → Diagnostics** and click **Refresh**. For extension errors, open CueWoven's card on the browser's extensions page and use **Errors** if available. Include the full error URL, CueWoven version, browser version and affected site when reporting a problem; do not share private page content, credentials or library backups. Diagnostics are session-only and may be empty after the browser restarts.

Chrome's [unpacked-extension instructions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) explain loading and reloading; refresh affected tabs so content scripts use the updated installation.

[User guide](docs/USAGE.md) · [Developer guide](CONTRIBUTING.md)
