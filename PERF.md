# Transcript-import performance experiments (v2.6)

| Change | Measurement | Result |
| --- | --- | --- |
| Replace full YouTube tabs with direct requests in default mode | Equivalent 12-way controlled caption jobs: v2.5 created 12 concurrent player pages; v2.6 created zero YouTube tabs and completed 14 videos | Kept: removes full-page rendering, playback and page scripts from the request path. No real-device RAM/CPU percentage or live throughput claim. |
| Limit opt-in fallback | Selected parallel value 12: old maximum 12 full pages; new maximum 2, tested through real capture pipeline | Kept: explicit compatibility choice with lower page load. |
| Coalesce completion notifications | 30 index-changed events: 30 immediate list reads/rebuilds before; 1 delayed refresh after | Kept: production browser regression checks one refresh and final saved data. |
| Serialize inference with priority and batches of 4 | Same isolated real-model test, 4 videos × 150 segments (75 chunks each), warm model, seeded search: existing 5,377 ms total / 33 ms search; candidate 5,693 ms / 233 ms | Reverted: slower in this measurement; existing model path retained. These single-run timings diagnose the rejected change, not a speed benchmark. |

Tests use synthetic captions and isolated profiles. YouTube can return empty signed captions or block requests, so fewer tabs does not promise faster or universally successful caption retrieval. No hidden iframe ships: a live embedded-player probe returned a configuration error.
