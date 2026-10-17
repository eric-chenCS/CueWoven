# Recall v2.9 installation

## From this repository

Install Node.js 22+ and pnpm 11.25.0. From the cloned repository, run `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm run vendor`, and `pnpm test`. Setup builds the required vendor runtime, which is excluded from Git. Then open edge://extensions or chrome://extensions, enable Developer mode, click Load unpacked, and select the repository root containing manifest.json.

## Existing installation

After pulling changes, rebuild with `pnpm run setup` if dependencies or the runtime build changed. Reload the Recall extension and refresh existing YouTube tabs. Reopen Library & settings. The version should read 2.9.0. Keeping the same folder preserves the extension identity and local library.

For v2.9, rebuild the vendor runtime (`pnpm run vendor`) because the bundle now exposes visual-model components. The packaged ZIP already includes it. The database automatically adds scene storage while retaining existing transcripts. **Save scene snapshots** is on by default; switch it off in settings if you prefer text/audio only. The first visual use downloads additional model weights. Snapshots are included automatically in the ordinary search, with Scene/Transcript/AI speech/Title evidence indicators; no search mode needs selecting. See UPDATE-2.9.md for sampling, storage and compatibility limits.

For history imported earlier, click Fetch missing transcripts; no re-import is needed. Both Takeout imports and the browser-history Add all action attempt transcripts by default, with separate title-only checkboxes. Keep settings open until titles are saved and the background job starts. After that you can close settings, keeping the browser open. Fetching uses one separate minimized window with six muted player tabs at a time by default; choose three in Settings → Parallel videos to reduce load. Your main tab bar stays clear. Return to settings for progress or Pause after active videos. The window closes after completion or pause; closing it manually pauses new work. It is minimized, not fully hidden or closed, and may appear in the taskbar. An extension/browser restart can interrupt the job; retry missing transcripts afterward. See UPDATE-2.7.md.

## Packaged installation or moving folders

After building the runtime, `pnpm run zip` creates recall-v2.9.zip. Extract it before using Load unpacked. A source ZIP from GitHub still needs `pnpm run setup`; it does not contain the generated runtime.

A different folder can mean a different extension identity. Export your old library through Library & settings → Export index before replacing or removing the old extension. Import that backup into the new installation. Avoid leaving both copies enabled on YouTube simultaneously.

## Optional history

New users can choose **Import history** or **Start empty**. Start empty adds no past data and requests no history access. The import option stays in settings for later.

To populate the library from a YouTube account export, use Google Takeout, select YouTube history in JSON format, extract the archive, and choose watch-history.json in Recall. JSON files up to 100 MB are accepted; HTML and ZIP files are not. The file is read locally and is not uploaded.

The saved titles, channels and watch dates support semantic title search immediately. Duplicate imports skip existing videos. Keep the settings page open while importing; if interrupted, import the same file again to skip completed entries. This does not automatically synchronize your Google account.

Alternatively, click Find YouTube history to scan this browser profile's saved visits. This requests optional history permission. Add all found videos saves the titles and then attempts their transcripts in the background by default. Uncheck Fetch transcripts when adding all videos for titles only, or select up to 20 videos for a smaller batch. The scan shows up to 500 recent unique videos and cannot recover deleted, incognito, or account-only activity from other devices.

## Transcript limitation

The user confirmed live caption capture and timestamp links work in their regular Edge session. Caption retrieval can still fail for particular videos or sessions. In v2.9, a normal video you are playing automatically falls back to English speech-to-text after captions fail. Reload the extension and refresh existing YouTube tabs to load the new audio script. No recording button, microphone or tab-capture permission is required. The first speech use downloads a local model; model loading and recognition use extra CPU. Watch the popup's Speech-to-text status or use Stop. The automatic fallback has an off switch in settings.

Speech-to-text captures only portions played after it starts, one video at a time. It skips detected ads and paused playback, splits at seeks/rate changes, labels results as partial AI speech, and can make recognition/timing errors. Unavailable or protected player audio can still fail. The background imported-history queue continues fetching captions; it does not silently play entire histories through speech recognition. Audio stays in memory on this device; saved speech text follows the same retention as other transcripts. See UPDATE-2.8.md.

## Data retention

Title-only imported history stays until you delete it. Once a video has a transcript, the selected transcript-retention period applies to its latest watch or indexing date. Rewatching an already indexed video updates recency without re-embedding it. Background Add transcript does not pretend the video was rewatched today.

Model downloads and thumbnail requests use the network. Transcripts, vectors and settings live in the current browser profile. Uninstalling or switching profiles does not transfer that library automatically; export a backup first.
