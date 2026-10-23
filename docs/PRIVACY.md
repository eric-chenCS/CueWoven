# CueWoven privacy policy

*Last updated: October 23, 2026*

CueWoven is a Microsoft Edge extension (it also works in Chrome) that lets you search videos and pages you have watched or read. It processes and stores the library on your computer. There is no CueWoven account, developer-operated server, analytics or advertising. The extension does not send your library or search queries to the developer.

## What CueWoven saves

Only on YouTube and on websites you choose to allow, CueWoven saves:

- **Video information:** title, channel, link, thumbnail address, when you watched it, and available captions.
- **Speech text:** if a video has no captions, an English transcript of the audio you played, made on your computer. Audio is buffered temporarily for processing and is not retained in the library or backup.
- **Scenes and on-screen text:** sampled still frames from videos you watch and text read from them.
- **Page text:** up to 2,000 visible words from allowed pages, up to three visible article images, and their captions.
- **Google searches:** only if you turn on "Save my Google searches" (off by default).

CueWoven does not capture incognito windows, and it skips known private services, sign-in and account pages, and sensitive routes. It also removes some text patterns that look like personal data, such as email addresses, phone numbers, card numbers, recognizable API keys, authorization tokens and private-key blocks. Secret detection is best-effort and does not cover every credential format. These filters reduce unwanted capture but cannot recognize every private page, and saved images are not redacted.

## Where it is stored and who can see it

The library is stored in your browser profile on your computer, using the extension's own storage. Searches run on your computer with local AI models. Saved text, transcripts, captured audio and search queries are not uploaded to the developer or an AI service. Websites and download hosts still receive the normal requests described below. Anyone with access to your browser profile or exported backup may be able to read its contents.

## Network requests CueWoven makes

- **AI model files** are downloaded from Hugging Face (huggingface.co and its download infrastructure) the first time a feature needs them, then cached. These requests do not include your saved content or search queries. Download hosts receive ordinary connection information, such as your IP address and request headers.
- **YouTube captions and transcripts** are requested from YouTube for the current video. These requests can use your existing YouTube session cookies; CueWoven does not send those cookies to the developer or an AI service.
- **Article images** on allowed pages are fetched again without cookies so they can be processed locally.
- **Thumbnails and the pages you open** load from their own websites. Those sites can receive ordinary connection information, and opening a result follows that site's normal cookie and privacy behavior.
- **Problem reports** are never sent automatically. If you write one under Diagnostics, CueWoven can open a pre-filled GitHub issue for you to review and submit, or copy it to your clipboard. Opening the issue page passes the report text to GitHub in the page address; it is posted only if you submit it. A report contains only your description, CueWoven and browser versions, storage used and which features are turned on, not sites, history or searches. Issues submitted on GitHub are public and follow GitHub's privacy policy.

## Permissions

- **YouTube access** lets CueWoven read the video you are watching and its captions.
- **Access to other websites** is optional. Microsoft Edge (or Chrome) asks you before granting it, and only for the sites you choose.
- **Storage and unlimited storage** keep your library on your computer.
- **System memory** checks physical RAM locally to choose the initial Lite mode default for devices with 8 GB or less. The capacity value is not saved or sent to the developer; your Lite mode preference and a setup-complete flag are saved locally.
- **Offscreen document, alarms and favicon** run the local search models in the background, remove old items on schedule, and show site icons in results.

## Your control

- Pause saving at any time, exclude a site, or forget everything saved from one site. Pending caption requests are discarded when you pause, exclude YouTube, or navigate away. This does not erase material already saved.
- Delete single items, forget what was saved in the last hour, day or week, or clear the whole library under Your data.
- Choose how long items are kept (24 hours to forever) and how much image storage is used.
- Export a backup file, which stays on your computer unless you move it.

Uninstalling CueWoven deletes its saved library from the browser.

## Children

CueWoven is not directed at children under 13. The extension processes browsing content locally as described above; the developer does not receive that library data.

## Store policies

CueWoven follows the Microsoft Edge Add-ons developer policies: browsing content is used only for the extension's single purpose of letting you search what you have watched or read, and it is not sold or transferred to third parties. When distributed through the Chrome Web Store, CueWoven's use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements. Browsing content is used only to provide the extension's local capture, search and data-management features. It is not sold or used for advertising, creditworthiness or lending decisions.

## Changes and contact

Changes to this policy will be posted here with a new date. Questions can be sent to [support@fusilite.com](mailto:support@fusilite.com) or asked on the project's [GitHub issues page](https://github.com/eric-chenCS/CueWoven/issues).
