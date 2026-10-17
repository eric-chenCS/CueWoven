# Recall v2.6

History transcript fetching now defaults to **No tabs**. It reads YouTube page data and attempts captions with HTTP requests instead of loading full video pages. The existing parallel setting controls up to 12 requests; it no longer creates that many YouTube tabs.

YouTube sometimes requires its live player/session to release captions. No-tabs attempts then retain the searchable title and show a reason. Open the video normally to use live capture, or opt into **Settings → Transcript fetching → Allow fallback tabs**. That mode tries direct fetching first and limits the whole job to two workers, so no more than two muted inactive fallback tabs can exist. It closes them after capture. There is no hidden-player workaround or external caption service.

Settings apply to the next job. Pause current work, reload Recall, reopen settings, and fetch missing transcripts. Keep the browser open; settings can close after the job starts. The existing library and original imported watch dates are preserved.

YouTube HTTP 429 responses pause the queue rather than continuing through the remaining history. Completion bursts coalesce library refreshes, reducing repeated list reads and DOM rebuilding. No new permissions or dependencies were added.

Controlled tests verify no-tab completion, failures that preserve titles, timestamps, pause, rate limits, settings persistence, and the two-tab opt-in fallback. A live public-video probe returned empty signed captions and a player configuration error in an embedded frame; successful live no-tab capture is not claimed. The existing live-player capture remains available.
