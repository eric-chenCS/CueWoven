# CueWoven 3.3.49 beta

The text engine now limits repeated worker starts to two per minute. A healthy worker keeps serving searches without a delay. If the engine repeatedly stops, it permits one immediate replacement and then reports how long to wait before retrying, instead of repeatedly allocating model workers. Normal unloading after a minute of inactivity is unchanged.

Bounded Edge tests reproduced substantial memory growth from rapid model-worker retirement, including when starts were spaced 1.5 seconds apart. A real-time test of the production restart limit blocked 20 rapid retries without creating more workers, then resumed inference after the window expired with an identical vector. This safeguards restart behavior; it is not a browser RAM cap or a verified fix for the two previously observed native V8 crashes.

Store submission guidance now explains system-memory permission, Lite defaults, opt-in visual capture and conditional timestamp/passage navigation. Screenshots use the current UI with bundled demo content. Model weights, precision, ranking, saved data formats, dependencies and permissions are unchanged.

Validation: 387 unit tests and all 15 maintained isolated Edge browser programs pass. The worker regression covers cooldown boundaries, healthy reuse, queued rejection, stale events and recovery; removing the restart guard fails its regression. Release packaging is separately checked for complete runtime files and tested with real first-use model download, offline search and backup/restore.

Limits: the original two native Edge/V8 failures remain unexplained. Repeated worker failures can require waiting up to a minute and trying again; native renderer loss may still require reloading. Second-computer testing and store certification remain separate. Only the installation ZIP is published; the store upload ZIP stays local.
