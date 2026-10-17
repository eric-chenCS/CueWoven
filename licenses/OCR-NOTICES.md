# OCR redistribution notices

Recall bundles and minifies the Tesseract.js 7.0.0 browser client. The upstream worker, Tesseract.js-core 7.0.0 LSTM cores and English trained data are copied unchanged. Only the selected core loads at runtime; scalar, SIMD and relaxed-SIMD variants are packaged for compatibility. Legacy OCR cores and separate unused WASM files are excluded.

- Tesseract.js: Apache-2.0, see tesseract-LICENSE.txt. Source: https://github.com/naptha/tesseract.js
- Tesseract.js-core / Tesseract: Apache-2.0, see tesseract-core-LICENSE.txt. Source: https://github.com/naptha/tesseract.js-core
- English 4.0.0_best_int/eng.traineddata.gz from @tesseract.js-data/eng 1.0.0. The naptha/tessdata source repository licenses its data under Apache-2.0 (the same license text is included in tesseract-LICENSE.txt): https://github.com/naptha/tessdata/blob/gh-pages/LICENSE . The npm wrapper metadata declares MIT; its JavaScript wrapper is not distributed by Recall.
- The copied browser worker's attribution notices are in tesseract-worker-notices.txt and vendor/ocr/worker.min.js.LICENSE.txt. Supporting package licenses are in tesseract-dependencies.txt. idb-keyval is Apache-2.0: https://github.com/jakearchibald/idb-keyval/blob/main/LICENCE

No third-party service receives video frames or recognized text. Code, OCR cores and English data are loaded from the extension. MiniLM, Whisper and CLIP weights retain the existing first-use download flow.
