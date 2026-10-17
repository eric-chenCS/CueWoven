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
