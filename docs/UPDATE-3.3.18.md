# Recall v3.3.18: recognizable website icons

Website lists now prefer bundled favicon images for all 31 suggested sites, including subdomains. Icons load offline, even before those sites have been visited in this browser profile. A small white backing keeps transparent black marks visible on dark site chips. This also makes known-site icons available to library/search cards while preserving saved image previews and video thumbnails as the first choice.

Custom sites continue using Edge/Chromium's favicon cache. If no usable image is available, the final fallback is a square globe, rather than the old wide page-shaped placeholder scaled into a 16-pixel slot. Custom sites without cached favicons can still show the browser's generic icon; the extension does not silently contact arbitrary websites or an external icon service.

No permissions, runtime network integration, model, storage migration or background work is added. The static icon assets total under 30 KB. Website names/marks remain their owners' property; provenance is documented in `icons/sites/README.md`.

Validation includes unit checks for every bundled PNG, subdomain/hostname boundaries, invalid URLs, saved-preview/thumbnail precedence and fallback termination. An isolated Chromium test loads all 31 brand icons with every HTTP(S) request blocked, checks both themes and the square-globe fallback, and confirms no external icon requests. Existing website, image and theme tests are retained.

The unchanged dependency audit still reports three high Node-only `sharp` advisories and one moderate Node-only `sprintf-js` advisory, outside the browser bundle. Existing remediation remains deferred for review by 2026-11-17.
