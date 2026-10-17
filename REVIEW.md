# Review — Recall v2.8.0

Reviewed the automatic speech fallback across correctness, module boundaries, input validation, privacy, cleanup and resource use. Audio originates in the isolated content script's current player, is transferred as bounded PCM packets and is never persisted or uploaded. No microphone, tabCapture, activeTab or other new permission was added. Only trusted extension contexts can forward audio-open/close controls; the controller validates the session/tab before accepting packets. Captured history tabs are excluded. Text renders through textContent, and full captions take precedence transactionally.

Review fixes include end/navigation cleanup, canceled module-open protection, packet-error cleanup, session-aware failure handling, the settings off switch, tab closure and coalesced progress updates. The browser test now waits for actual media end and explicitly polls backend state before restarting. The new Node tests cover automatic/deferred fallback and excluded caption/history cases. Removing the pause/ad guard failed the speech regression and was restored. All 87 Node tests, the real-model speech browser test, the existing import/search/background regressions and one actual public YouTube speech fallback passed. The speech UI screenshot was inspected.

Known practical limits are documented: English recognition errors, approximate timestamps, partial played coverage, first-use downloads, extra CPU, one live session, bounded backlog and unsupported/protected players. The unchanged locked dependency audit still reports native Node findings; the affected paths are not in the shipped browser runtime. This review does not certify every YouTube video, minimum browser version or sustained hardware performance. No unresolved release-blocking finding was identified in the tested scope.

# Historical review of the supplied findings — Recall v2.0.0

| Finding | Matches current code? | Resolution |
|---|---|---|
| 1. Live transcript capture fails; reports are missing from the ZIP | Yes. The reports previously sat beside the ZIP rather than inside it. Live requests returned empty caption bodies and HTTP 400 from the transcript API. | Reports now ship in the ZIP. Added capture of actual player fetch/XHR response bodies, exact signed-URL replay before any format change, and temporary caption activation with state restoration. Controlled tests pass, but actual YouTube still rejected the test browser. **Live capture is not resolved.** |
| 2. A rewatch retains the old imported watch date | Yes. Live messages lacked watchedAt, and fully indexed videos were skipped without refreshing recency. | Live captures send the current time. Existing transcript records are touched without re-embedding. Background bulk additions omit that timestamp and retain the old watch date. Concurrent writes preserve the later date. |
| 3. Imported history disappears after the default 30 days | Yes. All records were pruned by indexedAt. | Title-only imported entries are exempt from automatic transcript retention. The setting now states this. Transcript retention uses the latest watch or indexing activity. Explicit deletion remains available. |
| 4. A 25 MB Takeout limit is restrictive | Yes. There was also a 100,000-record rejection that asked people to split JSON. | Raised the file cap to 100 MB, removed that record-count rejection, and added size-boundary tests plus an actual 100 MB browser file-input test. That fixture contains one valid record and whitespace padding; it is not a large-corpus performance benchmark. |
| 5. Results disappear during every debounce | Yes. The input handler cleared the results immediately. | Existing results remain visible while typing; selection is reset. A blank query shows the idle state immediately. Sequence invalidation still rejects delayed old results. |
| 6. Extra runtime files, build metadata and contradictory README setup | Yes. The generated bundle references only the .jsep loader/binary. | Removed the plain runtime pair, saving 11,154,263 uncompressed bytes. Model inference passed afterward. The build now discovers referenced runtime names and keeps metadata in its dependency cache. Replaced the layered README with one setup workflow and packaged the docs. |

## Important qualification

The supplied caption-toggle suggestion was a reasonable hypothesis, not an established fix. The baseline also failed with captions already enabled. In v2, two headless live video attempts and a visible-browser repeat all failed, while caption state was restored correctly. Do not advertise live spoken-content capture as working based on the controlled tests.

The on-device title-search/import path is independent of live caption retrieval. Existing Recall backups containing transcripts still support spoken-content search.

The transcript-panel fallback now supports both legacy and newer view-model layouts. A final live repeat still failed. YouTube's native captions also failed without Recall in isolated Chromium and Edge profiles, so the remaining live failure is not specific to the extension. The normal signed-in Edge session needs a separate check.
