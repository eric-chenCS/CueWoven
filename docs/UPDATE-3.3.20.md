# Momento v3.3.20

Recall is now **Momento**. The extension manager, toolbar text, popup, settings, accessibility labels, notifications/errors, background-capture page, demo player and current setup/contributor documentation use the new name. Release ZIPs are named `momento-v3.3.20.zip`; new backup downloads use `momento-index-YYYY-MM-DD.json`.

The extension stays in its existing installed folder. Its browser identity, `recall` IndexedDB database, settings, internal capture protocols, `rc` address-bar shortcut and `recall-export` backup format remain compatible. Existing backups still import. User-supplied titles and history are not renamed. Existing authored samples display their new branding without rewriting saved user content. Historical release notes and references to Microsoft's separate Recall product retain their original names.

During compatibility checks, backup restore was found to retain an obsolete 2,000-image cutoff. Both restore paths now use the existing shared 20,000-image limit, with a regression test covering the entire expanded capacity. The 240 MiB visual budget and per-item capture limits are unchanged.

Validation covers visible branding in Chromium, the original database name, existing-content preservation, a legacy backup export/import roundtrip, new download filenames, retained keyboard/icon access and the unit suite. The rename adds no models, permissions or background processing.

The unchanged dependency audit reports three high Node-only `sharp` advisories and one moderate Node-only `sprintf-js` advisory outside the browser bundle. Existing remediation remains deferred for review by 2026-11-17.
