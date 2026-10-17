# Scene sampling and unified search (v2.9)

Frames are encoded at no more than 320 × 180, at most once per 20 wall seconds and per playback bucket, only from a visible playing video. The live saved JPEG data URL was 11,323 characters; the hard input limit is 90,000 characters. Caps are 120 snapshots per video and 1,000 total. These caps bound frame storage rather than claiming every video fits a fixed byte size. Search reads scene metadata/vectors through a cursor and loads image data only for final displayed matches. One inference runs at a time, with at most the newest text query waiting; new frames skip a busy worker. The visual worker expires after 60 seconds idle.

The real CLIP model test took 3,678 ms to initialize/embed a public image. The existing bundle grew from 868,255 to 868,380 bytes when exposing the model classes; additional weights download separately. This is a single-run diagnostic and package-size measurement, not a CPU, memory or throughput improvement. Visual work adds cost, especially alongside speech recognition. Both models indexed one live public YouTube session successfully; the user can disable snapshots if the extra load is undesirable. The storage-cap and bounded-worker tests guard resource growth.

# Automatic speech fallback (v2.8)

Recognition runs in a separate worker using quantized Whisper tiny.en on one WASM thread. The audio worklet emits one second of 16 kHz mono PCM per message, with no video frames sent to the extension. Recognition uses 15-second windows, one inference at a time, at most two queued windows plus the in-flight window. Silence is skipped. Backlog stops capture instead of growing indefinitely, and the worker is released after stopping. Speech model progress notifications are coalesced to percentage changes. Background history capture tabs never load the speech model.

In one isolated model check, a 14.14-second generated speech fixture took 3,286 ms to prepare and 1,758 ms to recognize. These single-run timings are diagnostic evidence, not a device-wide speed or RAM claim. Actual player-audio capture, recognition, embedding and search passed both the controlled end-to-end test and one live public YouTube video. English recognition is imperfect and coverage begins after caption failure/model preparation, not at the start of the video. First downloads and sustained recognition add network/CPU cost; the existing search and import regressions pass with this feature enabled.

# Minimized capture window (v2.7)

Request-only capture from v2.6 is removed. Six full YouTube players run in one separate minimized window (or three for lower load). This isolates the main tab bar and restores player/session capture; it does not claim lower per-player memory/CPU or bypass YouTube restrictions. The headed Windows regression completed eight controlled videos with six concurrent players while preserving main-window focus; normal completion, pause and manual closure cleaned up the owned window. Coalesced library refresh remains: 30 completion events produce one refresh.

A create-about:blank-then-navigate approach repeatedly stalled the last controlled navigation. Opening the player URL directly eliminated that reproduced stall. Adding tabs can restore a Chromium window, so Recall reapplies minimized state without issuing a focus command. Issuing focused:false again while minimizing changed the main-window focus in a headed test; using a state-only update passed. These are browser behavior checks, not a throughput or RAM benchmark.

# Transcript-import performance experiments (v2.6)

| Change | Measurement | Result |
| --- | --- | --- |
| Replace full YouTube tabs with direct requests in default mode | Equivalent 12-way controlled caption jobs: v2.5 created 12 concurrent player pages; v2.6 created zero YouTube tabs and completed 14 videos | Kept: removes full-page rendering, playback and page scripts from the request path. No real-device RAM/CPU percentage or live throughput claim. |
| Limit opt-in fallback | Selected parallel value 12: old maximum 12 full pages; new maximum 2, tested through real capture pipeline | Kept: explicit compatibility choice with lower page load. |
| Coalesce completion notifications | 30 index-changed events: 30 immediate list reads/rebuilds before; 1 delayed refresh after | Kept: production browser regression checks one refresh and final saved data. |
| Serialize inference with priority and batches of 4 | Same isolated real-model test, 4 videos × 150 segments (75 chunks each), warm model, seeded search: existing 5,377 ms total / 33 ms search; candidate 5,693 ms / 233 ms | Reverted: slower in this measurement; existing model path retained. These single-run timings diagnose the rejected change, not a speed benchmark. |

Tests use synthetic captions and isolated profiles. YouTube can return empty signed captions or block requests, so fewer tabs does not promise faster or universally successful caption retrieval. No hidden iframe ships: a live embedded-player probe returned a configuration error.
