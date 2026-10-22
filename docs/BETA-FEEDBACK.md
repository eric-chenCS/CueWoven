# Small beta feedback guide

Start with three to five willing testers, including an 8 GB laptop and a 16 GB laptop if available. Ask them to try their own normal browsing for a few days. Synthetic tests help catch regressions; they do not establish real-user accuracy or performance. There is no new telemetry or feedback upload in the extension.

## Normal-browser caption check

1. Record the CueWoven version, browser version, operating system and whether Lite mode is on. Reload the extension and refresh the video tab after an update.
2. Use an ordinary browser profile, not an automated test profile. Choose a public video whose captions actually appear in YouTube's player. Watch at least 30 seconds with saving enabled. Avoid sharing private viewing history, cookies or browser profiles.
3. Search CueWoven for an actual phrase that was spoken. Check the evidence label and timestamp link. **Transcript** means that result uses captured captions; **Audio** means local speech recognition supplied that result. In Lite mode speech fallback is disabled, so a caption failure may leave only the title. A title alone does not prove speech was indexed.
4. If the result is Audio or title-only, allow any preparing-text state to finish and retry. Repeat with a second captioned video. One Audio result does not establish a universal capture failure. Record whether playback captions were visible, the exact capture message and whether the transcript-panel fallback succeeds. A manually retrieved transcript is useful evidence, but does not clear automatic caption fetching.

Repeated automatic-caption failures in a normal profile merit investigation before calling that browser configuration supported. YouTube returning empty responses in an automated session is not enough to establish the cause. Do not paste authentication tokens or signed caption URLs into feedback.

## Questions for testers

- Could you install, open and pin CueWoven without help? Which wording was unclear?
- Could you find something from your own memory? Try an exact phrase and then a natural paraphrase. Record whether the expected item and moment appeared; include misses, not just successes.
- Did background saving or searching interrupt browsing? Note RAM capacity, Lite mode, visual-capture setting and whether models were loading for the first time. Separate first-load waiting from repeat searches. Note any crash and whether recovery needed user action.

Use a short report: version/browser/OS/RAM; settings relevant to the issue; steps; expected and actual result; first or repeat search; optional public video link and approximate timestamp. Share only information the tester chooses to disclose. A sanitized example query is enough to begin; full library exports and private pages are not required.

Keep the existing ranking and Related classification during this beta so results are comparable. Track issues as installation, missing capture, incorrect retrieval, wrong timestamp, or resource/recovery problems; these need different fixes. Automatic-caption compatibility and the previously observed native Edge crash remain open until reproduced and verified independently.
