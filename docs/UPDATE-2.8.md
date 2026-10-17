# Recall v2.8 — Automatic speech fallback

When caption capture fails for the normal YouTube video you are playing, Recall automatically transcribes the player's audio locally. Continue watching; there is no extra recording button or microphone permission. Existing installations must reload Recall and refresh YouTube tabs. Keep the installed folder path unchanged to retain the extension identity and library.

The popup shows model download, listening and finishing states, with Stop and an optional retry. Settings includes an automatic speech-to-text off switch. Recognition uses the existing bundled Transformers.js runtime with quantized `Xenova/whisper-tiny.en` in a dedicated worker. MiniLM still handles semantic search. No API key or speech service is used. [The model's Transformers.js usage](https://huggingface.co/Xenova/whisper-tiny.en) and [the player capture API](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/captureStream) describe the underlying components; compatibility is also tested in this repository.

Speech recognition currently supports English and saves only the portions played after capture starts. Caption retrieval and initial model download can delay that start. Model weights download from Hugging Face and use the browser cache; audio is processed in memory and is never uploaded or saved as a recording. The saved text, embeddings and timestamps stay in the current browser profile. Recognition and timestamp errors are possible, especially with music, noisy audio or other languages. Unsupported or protected media may not expose usable audio. Speech results are explicitly labeled AI speech and partial coverage.

One live speech session runs at a time. Audio is resampled to 16 kHz, processed in 15-second windows, and queued with a bounded backlog. Silence is discarded. Paused playback and detected ads are excluded; seeks and playback-rate changes split ranges. If recognition falls behind, capture stops and finishes buffered audio instead of growing memory indefinitely. Stop, video end, page navigation, tab closure and the settings off switch stop capture. The worker is released after finishing. Full captions take precedence over partial speech results, including concurrent writes. A rewatch replaces overlapping speech ranges; nonoverlapping ranges remain searchable. Backup export/import retains partial coverage and range metadata.

History import continues fetching captions in the existing separate minimized window with six muted players by default. It never launches speech recognition for those capture tabs. Watching a normal video can still trigger live capture while that queue runs. Speech results can later be upgraded through Add transcript or Fetch missing transcripts.

## Verification

Run `pnpm test`. Browser tests use an isolated Chromium profile and Playwright supplied by the developer environment. Set `RECALL_PLAYWRIGHT` to the Playwright module and `RECALL_BROWSER` to the browser executable if they are not otherwise available. For the speech fixture, generate a WAV without using the microphone:

```powershell
powershell -File tests/browser/make-speech-fixture.ps1 -OutputPath "$env:TEMP/recall-speech.wav"
$env:RECALL_SPEECH_WAV = "$env:TEMP/recall-speech.wav"
node tests/browser/speech-model.cjs
node tests/browser/auto-speech.cjs
```

The fixture test uses real media playback, player PCM, local Whisper and MiniLM, IndexedDB, search and popup controls. Only the YouTube page and spoken fixture are controlled. `node tests/browser/live-speech.cjs` optionally checks a public YouTube video and reports external failures without pretending a controlled test proves universal compatibility. Detailed results and limits are in TEST-REPORT.md.
