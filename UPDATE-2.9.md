# Recall v2.9 — Scene evidence in the normal search

Describe either what was said or what was on screen in the same search box. Recall searches saved titles, transcripts, speech text and sampled scene images. Results have Scene, Transcript, AI speech or Title indicators. Matching speech and a scene within 15 seconds can show both indicators. Scene results display the actual saved snapshot and open the video at its capture timestamp. The existing one-video default, arrow navigation, refinements and filters remain. There is no separate scene-search mode.

Reload the extension and refresh YouTube tabs after updating the existing installed folder. Teammates loading a checkout must rebuild `vendor/` with `pnpm run vendor`, because new exports from the existing Transformers.js dependency are needed. No dependency or browser permission was added. The IndexedDB upgrade adds a scene store without changing existing videos or transcript chunks; a v1 migration regression verifies preservation.

## Capture and privacy

Save scene snapshots is enabled by default, with an off switch in settings. Recall samples the current video's rendered frame after the configured watch delay (at least three seconds), then at most once per 20 wall seconds and once per 20-second playback bucket. It does not capture the desktop, browser controls, other sites or hidden tabs. Pauses, seeks and detected ads are excluded. Background imported-history capture tabs never save scenes. Leaving the video clears the sampler; already captured images can finish indexing. History cannot supply missing frames from before installation or portions you did not play visibly.

Snapshots are JPEGs up to 320 × 180 pixels. The stored image, visual vector and timestamp stay in the current browser profile and are not uploaded. A local quantized CLIP model (`Xenova/clip-vit-base-patch32`) compares English descriptions to images; the first image/query uses additional model downloads from Hugging Face. See [the model](https://huggingface.co/Xenova/clip-vit-base-patch32) and [Transformers.js image feature extraction](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.ImageFeatureExtractionPipeline). Image pixels are processed locally in a dedicated worker. Caption and speech capture remain independent.

## Bounds and matching limits

At most 120 snapshots per video and 1,000 total are kept, with oldest images removed first. Snapshot age follows the existing transcript-retention setting; imported titles may remain after their images expire. Deleting a video or clearing the index removes its images. Export/import includes snapshots and re-creates their visual vectors. Backups can therefore be larger and contain the actual watched images.

Scene inference is serialized. A busy model skips new sampling work, while only the newest waiting text query is retained; it never builds an unlimited frame/query backlog. The worker is released after 60 seconds without work. Frame sampling, visual model loads and inference add CPU/memory cost; there is no claim of zero playback impact or hardware-wide performance improvement. Protected media or cross-origin canvas restrictions may prevent snapshots; Recall reports that limitation and retains text/audio search.

Scene search is approximate. Sampling can miss brief scenes and cannot interpret an entire action sequence between frames. MiniLM and CLIP cosine values are not interchangeable probabilities: eligible candidates are combined through reciprocal-rank fusion, with strong spoken matches preferred in rank ties and weak visual matches filtered. This is a ranking heuristic, not a guarantee of the most likely video. Nearby evidence can be up to 15 seconds apart. If the visual model fails, ordinary title/transcript search remains available with an error notice.

## Verification

`pnpm test` checks sampling guards, input/image limits, bounded visual requests, fusion, evidence labels, pagination and existing features. A deliberate mutation removing the ad exclusion failed the capture regression and was restored.

`tests/browser/scenes.cjs` uses actual canvas-to-video playback and real local CLIP/MiniLM models with controlled video pages. It verifies a visual-only query, a strong transcript match at 0:42, indicators/previews, arrows, backup restore, storage caps, retention, deletion and migration of an existing v1 transcript. `tests/browser/scene-model.cjs` independently checks image/text embedding compatibility using a public test image. `tests/browser/live-scenes.cjs` checks one live public YouTube video without mocked frame/caption/model responses. Results are in LIVE-SCENES-2.9.json and TEST-REPORT.md. These checks do not establish universal video/browser recognition accuracy or sustained memory/CPU behavior.
