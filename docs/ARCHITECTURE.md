# How CueWoven works

CueWoven is a Manifest V3 extension. Its interface, collection scripts and local inference are separated so browsing and searches can continue while background work is queued.

## Data flow

Allowed page/player → capture and validation → bounded local inference → IndexedDB → ranked search → source link.

YouTube's main-world script reads player/session information; the isolated bridge validates and forwards it to the service worker. Optional website scripts extract visible page text and compatible player evidence. They respect site permissions, exclusions and capture settings. Specific YouTube links request available captions; backup restore validates saved text and images. There is no browser-history scanner or Takeout importer.

The service worker coordinates permissions, capture status, transcript jobs and messages. An offscreen document owns persistent engine operations and delegates inference to workers. Saved metadata, passages, images and vectors live in IndexedDB. The original internal database/protocol names remain for compatibility with earlier installations and backups.

## Models and evidence

| Evidence | Implementation | Main constraint |
| --- | --- | --- |
| Passage/query meaning | `Xenova/all-MiniLM-L6-v2`, 384-dimensional embeddings | Semantic similarity needs lexical/context checks |
| Played speech | `Xenova/whisper-tiny.en` | English-only, approximate recognition/timing |
| Scenes and article images | `Xenova/clip-vit-base-patch32` | Sampled visual similarity can be ambiguous |
| Burned-in text | Tesseract English OCR | Small, brief or low-contrast text can fail |

Transformers.js and ONNX Runtime Web run bundled browser code locally; model weights download on demand. OCR worker code and English data ship with the extension. Search combines semantic vectors, normalized word/phrase matches and source/title/date context. Text, speech, OCR, title and page evidence stay primary when a result has close lexical evidence or a score of at least 0.45, the existing strong-text cutoff. Only when that check finds nothing does search query CLIP and use eligible scenes/article images as the fallback pool. Text and image ranks are not blended. Fallback selection uses the full ranked text pool before pagination. Evidence types stay visible in results. Scores are ranking signals, not calibrated probabilities.

## Performance choices

Text queries use a separate worker with priority over bounded background batches. Cache revisions distinguish additions from removals: additions can finish against an existing snapshot, while destructive mutations invalidate stale results. Metadata-only video saves avoid rebuilding all text vectors. Normalized passages and bounded reads reduce repeated Unicode work; title bundles reduce history-record overhead.

Resident video vectors use 8-bit storage, with recent full-transcript content bounded and older content searched from disk as needed. Scene sampling adapts to change, OCR limits unchanged-frame work, and model workers release after idle periods. Explicit payload/image caps and Lite mode constrain capture cost; they do not establish a fixed total browser-memory limit.

## Source map

| Path | Responsibility |
| --- | --- |
| `manifest.json`, `background.js` | Browser configuration, service worker and job coordination |
| `content/` | Page/player extraction, playback timing, audio and sampled frames |
| `capture/` | Legacy capture assets; background transcript-fetch workflows are removed |
| `offscreen/` | Local engine and inference workers |
| `lib/` | Ranking, storage, privacy policy, queues, retention and shared utilities |
| `popup/`, `options/`, `styles/` | Search and settings interface |
| `samples/` | Original demo clips and their local player |
| `scripts/` | Browser runtime build and ZIP packaging |
| `tests/` | Node and isolated Chromium checks |
| `licenses/` | Third-party runtime notices |

## Validation

The current working-source suite has 319 Node tests; released test counts are recorded separately in the [test report](TEST-REPORT.md). Browser checks exercise actual extension messages, model inference, controlled capture outcomes, search, backups, permissions and responsive UI in temporary profiles. The branding compatibility check preserves the original database, settings and saved titles while round-tripping a backup.

Historical measurements and evaluations live in [the documentation index](README.md). Read their named versions and fixture limits: synthetic tests and controlled player responses do not prove live transcript availability, universal site support or a general accuracy percentage. No test evidence should be read as a claim that the extension continuously records every page or frame.
