# CueWoven 3.3.52 beta

Settings → Diagnostics now has **Report a bug or error**. Users describe what happened, then either open a pre-filled GitHub issue to review and submit, or copy the report to paste into an email or issue. A report contains only the description, CueWoven version, exact browser build and platform, storage used and which features are on. It never includes sites, history or searches. Nothing leaves the computer until the user chooses Open or Copy; opening the issue page passes the text to GitHub in the page address, and it is posted only if the user submits it. The privacy policy describes this.

The browser line uses `navigator.userAgentData` so reports show the full build (for example, Microsoft Edge 155.0.4283.62) instead of the reduced user-agent string, falling back to the user agent when unavailable. Reports ask users to attach the matching `edge://crashes` entry if the browser crashed.

Validation: 399 unit tests pass, including report content, empty input, long-description shortening and unknown storage. A real Edge 155 check verified the empty-report message, the issue address, title and body, copied text and light/dark layout. Settings-page browser checks (gray-theme, release-ui, confirmation-actions) pass. `security-hardening` failed intermittently in this test setup on both 3.3.51 and 3.3.52 at its page-capture wait; it is not caused by this change.

Capture, search, models, stored data, permissions and dependencies are unchanged. The earlier native Edge/V8 crashes remain unexplained. Only the install ZIP is published; the store ZIP stays local.
