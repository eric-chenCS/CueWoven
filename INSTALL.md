# Recall v2.1 installation

## From this repository

Install Node.js 22+ and pnpm 11.25.0. From the cloned repository, run `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm run vendor`, and `pnpm test`. Setup builds the required vendor runtime, which is excluded from Git. Then open edge://extensions or chrome://extensions, enable Developer mode, click Load unpacked, and select the repository root containing manifest.json.

## Existing installation

After pulling changes, rebuild with `pnpm run setup` if dependencies or the runtime build changed. Reload the Recall extension and refresh existing YouTube tabs. Reopen Library & settings. The version should read 2.1.0. Keeping the same folder preserves the extension identity and local library.

For history imported earlier, click Fetch missing transcripts; no re-import is needed. New Takeout imports attempt transcripts automatically unless Fetch transcripts after import is unchecked. Keep the settings page open and use Pause after current video whenever needed. See UPDATE-2.1.md for validation and limits.

## Packaged installation or moving folders

After building the runtime, `pnpm run zip` creates recall-v2.1.zip. Extract it before using Load unpacked. A source ZIP from GitHub still needs `pnpm run setup`; it does not contain the generated runtime.

A different folder can mean a different extension identity. Export your old library through Library & settings → Export index before replacing or removing the old extension. Import that backup into the new installation. Avoid leaving both copies enabled on YouTube simultaneously.

## Optional history

New users can choose **Import history** or **Start empty**. Start empty adds no past data and requests no history access. The import option stays in settings for later.

To populate the library from a YouTube account export, use Google Takeout, select YouTube history in JSON format, extract the archive, and choose watch-history.json in Recall. JSON files up to 100 MB are accepted; HTML and ZIP files are not. The file is read locally and is not uploaded.

The saved titles, channels and watch dates support semantic title search immediately. Duplicate imports skip existing videos. Keep the settings page open while importing; if interrupted, import the same file again to skip completed entries. This does not automatically synchronize your Google account.

Alternatively, click Find YouTube history to scan this browser profile's saved visits. This requests optional history permission. Search the returned titles, save them using Add all found titles to Recall, or select up to 20 per batch to attempt transcript indexing. The scan shows up to 500 recent unique videos and cannot recover deleted, incognito, or account-only activity from other devices.

## Transcript limitation

The user confirmed live capture and timestamp links work in their regular Edge session. Earlier isolated-browser tests failed, including YouTube's own captions without Recall. Transcript fetching can still fail for particular videos or sessions. Failed attempts retain title-only search, which does not provide exact-second spoken-content matches.

## Data retention

Title-only imported history stays until you delete it. Once a video has a transcript, the selected transcript-retention period applies to its latest watch or indexing date. Rewatching an already indexed video updates recency without re-embedding it. Background Add transcript does not pretend the video was rewatched today.

Model downloads and thumbnail requests use the network. Transcripts, vectors and settings live in the current browser profile. Uninstalling or switching profiles does not transfer that library automatically; export a backup first.
