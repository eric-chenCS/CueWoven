# Recall 2.4.0 — background transcript fetching for both history imports

The browser-history **Add all found videos to Recall** action now saves titles and fetches available transcripts automatically, like Takeout import. Its checkbox is on by default and can be unchecked for titles only. Already indexed videos are skipped. Only videos in the imported file or browser scan are queued; unrelated saved titles are left alone.

Transcript jobs now live in the background service worker, independently of the settings page. Up to **three videos** are processed concurrently through inactive muted tabs. Model warmup happens before starting capture tabs. Tabs close afterward, including on failure. Once title saving has finished and the job starts, settings can be closed; reopening it restores progress. The browser must remain open.

**Pause after active videos** stops new fetches while up to three in-flight videos finish. Failed or unavailable captions leave their saved titles. Existing Fetch missing transcripts can retry them later. Browser restart, extension reload, or worker interruption can stop a job. On a worker restart within the same browser session, stale tracked capture tabs are closed only if they still match that job's video and internal capture flag, and the job is shown as interrupted. Completed transcripts remain saved. Jobs are not silently resumed after an interruption.

Caption polling now uses elapsed-time deadlines, so background timer throttling does not stretch a fixed count of polling cycles. This and parallel fetching reduce avoidable waiting; actual YouTube speed and caption availability remain outside Recall's control. Temporary background tabs are still required for the current player/session capture approach. There is no promise of instant processing or a measured live speedup on the user's account.

Deletion, clearing and backup replacement are blocked while a transcript job is active, preventing a background fetch from undoing a user's data changes. No dependency or permission was added.

## Validation

- 49 Node tests pass, including concurrency bounds, pause, one model warmup, deduplication, bounded progress logs, invalid IDs, competing jobs, interrupted state, warmup failure, library-only job controls and throttled-timer polling.
- The real service-worker browser test processed six controlled YouTube videos after every settings tab was closed. It observed three simultaneous inactive/muted tabs, restored finished progress, original watch dates, real-model search at 0:42 and tab cleanup. A second job paused after its three active fetches, leaving three unattempted.
- Both Takeout and an actual isolated browser-history scan passed 53-video import tests using the production queue with controlled caption outcomes. They verify default transcript fetching, no 50-video truncation, title preservation, dates, transcript search, opt-out, already-indexed skipping and pause. The scan does not use the user's history; its optional permission is pregranted only in the fixture.
- Live YouTube/account-wide speed was not benchmarked. Earlier isolated-browser live caption restrictions still apply; the project owner previously confirmed normal Edge live capture works.

Pause any current old-version run before reloading Recall, then reopen Library & settings. Version should read **2.4.0**. After a new job starts, settings can be closed while the browser stays open.
