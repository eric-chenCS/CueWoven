# CueWoven 3.3.54 beta

The English OCR language data now ships uncompressed (`vendor/ocr/eng.traineddata`) instead of as `eng.traineddata.gz`. Microsoft Edge Add-ons rejects packages that contain compressed files, so 3.3.53 could not be uploaded. Tesseract.js now loads the plain file (`gzip: false`), and packaging fails if the old `.gz` is still present.

On-screen text reading, search, capture, models, permissions and defaults are otherwise unchanged. The store ZIP stays about the same size because the ZIP itself compresses the data.

Validation: 406 unit tests pass, including a new packaging check for the stale `.gz`. The real-OCR screen-text browser test and the maintained Edge browser programs pass with the uncompressed data.
