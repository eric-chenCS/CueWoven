# CueWoven 3.3.57 beta

**A clearer first run.** A new-user walkthrough in a fresh Edge profile, with real model downloads, found that the first thing people try looked unsure of itself. Fixed:

- **Try samples is the obvious first step.** In the popup's "Fill your library" card it is now the highlighted button; Restore backup (which new users don't have) moved beside Skip for now.
- **The sample search is confident.** The suggested search "why do batteries wear out" used to come back labelled "Related" with the "narrow it down" panel open, because the battery caption never said "wear out". The caption now does, so the demo shows a close match with the remembered words highlighted.
- **Samples have thumbnails** instead of a grey globe.
- **Samples say CueWoven.** The bundled sample videos still showed the old "RECALL · ORIGINAL SAMPLE" label; they now read "CUEWOVEN · ORIGINAL SAMPLE", and the battery video's burned-in caption matches the new wording.
- **The sample player opens at the moment and plays.** It used to open paused on the frame just before the matching caption.
- **Plain wording.** The empty library says "Nothing saved yet" instead of "Nothing indexed yet" and explains how to try the samples; the welcome page says "Your browser asks" instead of "Chrome asks".

Measured on this machine with real downloads: the search model loaded in about 3 seconds, samples were ready about 3 seconds after clicking Try samples, and searches answered in under 60 ms.

Validation: 408 unit tests pass, including the bundled sample poster mapping (only sample ids map to bundled files). The maintained browser set and the sample-flow browser tests pass.
