# Recall 3.3.6

Default dropdown choices now say (default option): System appearance, 20 seconds watch time, 2 moments per video, 6 concurrent fetches, 4 weeks for watched/read retention and Forever for imported history. Capture switches show their default On/Off state.

Settings has a button named exactly Reset settings to default. It restores capture switches, watch time, moments per video, fetch concurrency, System appearance and the popup's default best-match view. Retention choices under Your data, allowed/excluded sites, optional browser grants and saved content remain unchanged. This avoids triggering expiry or changing site access during a preference reset. The explanatory text next to the button states that scope.

The UI and service worker share one default-settings definition so labels and behavior agree. No permission, dependency, schema or model changes.

Validation: 231 Node tests; browser preferences/reset and responsive UI checks. Reset preserves saved records, legacy retention, site configuration and permission grants, survives reload, and restores enabled controls. A disposable mutation that overwrites retention fails its preservation regression.
