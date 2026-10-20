# Store listing — Chrome Web Store and Microsoft Edge Add-ons

Copy these answers into each dashboard. Upload `cuewoven-store-v<version>.zip` from `node scripts/zip.mjs --store`, not the GitHub release ZIP. Images are in [store/](store/).

## Shared details

| Field | Value |
|---|---|
| Name | CueWoven – Search Your History (from the manifest) |
| Category | Productivity |
| Language | English |
| Homepage / website | https://github.com/eric-chenCS/CueWoven |
| Support | https://github.com/eric-chenCS/CueWoven/issues |
| Privacy policy URL | https://github.com/eric-chenCS/CueWoven/blob/privacy-policy/docs/PRIVACY.md |
| Pricing | Free, no in-app purchases |

**Short description (132 characters max; Chrome uses the manifest description):**

> Find watched videos, articles and searches from a vague memory. Optional website capture; local text, audio and scene search.

**Detailed description:**

> Remember a video or article but not its name? Describe what you remember and CueWoven finds it.
>
> CueWoven saves the YouTube videos you watch, and pages on sites you choose, into a private library on your computer. Later, search it the way you remember things:
>
> • Something that was said: "the part where they explained compound interest"
> • Something you saw: "a red car on a mountain road"
> • Text that was on screen, a channel or site name, or when you saw it: "3 days ago", "last week", "in September"
>
> Results open at the matching moment in the video or the matching passage on the page.
>
> Private by design
> • Everything is saved and searched on your computer with local AI models. There is no account, no server and no tracking.
> • YouTube is the only site saved at first. Other sites are saved only after you allow them.
> • Incognito capture is excluded. Filters skip known private services and sensitive routes and redact some email, phone and card-number patterns. They cannot recognize every sensitive page or text pattern, and captured images are not redacted.
> • Pause saving, exclude a site, forget recent items or clear everything at any time. Choose how long items are kept.
>
> Open search with Ctrl+Shift+F (⌘+Shift+K on Mac) or the toolbar icon. Model files download from Hugging Face when a feature first needs them, then are cached. Search over saved evidence works offline once the required models are cached. Opening the original page or video requires its normal network access.

## Chrome Web Store — Privacy practices tab

**Single purpose:**

> CueWoven lets the user search videos and web pages they have already watched or read, using a library saved on their own computer.

**Permission justifications:**

| Permission | Justification |
|---|---|
| storage | Saves the user's settings and site choices. |
| unlimitedStorage | The searchable library (transcripts, page text, image embeddings) is kept locally and can exceed the default quota; the user sets the image storage size and retention. |
| offscreen | Runs the local AI search models (text, speech and image) in an offscreen document so search works without sending data anywhere. |
| alarms | Removes items older than the user's chosen retention period on a schedule. |
| favicon | Shows each saved site's icon next to its search results. |
| scripting (optional) | Injects the capture script into websites only after the user allows those sites. |
| Host: https://www.youtube.com/* | Reads the title, captions and playback position of the YouTube video the user is watching so it can be searched later. |
| Optional hosts: https://\*/\*, http://\*/\* | Requested at runtime only for sites the user picks, so text and images from those pages can be saved for search. Never granted by default. |

**Remote code:** No, I am not using remote code. (All JavaScript and WebAssembly is in the package. AI model weights downloaded from Hugging Face are data files, not code.)

**Data usage — collected data types (check these):**

- Web history
- Website content

Leave all others unchecked. Note in any free-text field that this data is stored only on the user's device and never transmitted to the developer.

**Certifications (check all three):**

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Notes for the reviewer (Test instructions field):**

> No account is needed. Install, complete first-run setup, and open a public YouTube video. After the configured watch delay and model setup, available evidence appears under Library & settings. For a repeatable demonstration, click "Try sample videos" in the popup to load five bundled demos, search "why do batteries wear out", and press Enter. All inference is local. Network requests include model downloads from Hugging Face and its download infrastructure, YouTube caption/transcript requests, permitted article-image fetches, and thumbnails. Download hosts and content sites receive ordinary connection information; saved content and search queries are not sent to an AI service or the developer. Pause saving while a caption request is pending to verify that the late result is discarded.

## Microsoft Edge Add-ons (Partner Center)

- Use the same ZIP, description, privacy policy URL, category and images.
- **Search terms** (up to 7): video search, history search, transcript search, YouTube history, local AI, memory, find video
- **Notes for certification:** paste the reviewer notes above.
- Edge requires the description to be at least 250 characters; the detailed description above qualifies.

## Images

| File | Size | Use |
|---|---|---|
| store/screenshot-1-search.png | 1280×800 | Search by something that was said |
| store/screenshot-2-moment.png | 1280×800 | Jump to the matching moment |
| store/screenshot-3-dates.png | 1280×800 | Typed dates narrow results |
| store/screenshot-4-library.png | 1280×800 | Library & settings |
| store/promo-small-440x280.png | 440×280 | Chrome small promo tile (required) |
| icons/icon128.png | 128×128 | Store icon (both stores; Edge accepts 128 or larger) |

Before submitting, recapture the screenshots if the UI has changed since the version they show.
