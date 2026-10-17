# Working on Recall

Use Node.js 22+ and pnpm 11.25.0. Run `pnpm install --frozen-lockfile --ignore-scripts` followed by `pnpm run vendor` on a fresh clone, then load the repository root as an unpacked extension. The generated `vendor/` runtime is required but stays out of Git.

Make small changes on a branch, run `pnpm test`, and open a pull request. Check the affected behavior in the browser too: Node tests do not prove live YouTube caption availability. Content scripts require refreshing YouTube tabs after reloading the extension. Rebuild with `pnpm run vendor` after changing `scripts/embedder-entry.js`, `scripts/vendor.mjs`, or the dependency graph.

Keep video metadata, transcript validation, original watch dates, optional history permissions and failed-import recovery intact. Do not commit watch history, Recall backups, browser profiles, cookies, credentials, model weights or generated bundles. No personal YouTube API key is required.

For the optional browser regression, install Playwright separately from the project's production dependencies. Set `RECALL_PLAYWRIGHT` to its module path and `RECALL_BROWSER` to a Chromium executable that supports loading unpacked extensions, then run:

```sh
node tests/browser/import-transcripts.cjs
node tests/browser/refine-search.cjs
node tests/browser/single-video.cjs
```

This uses controlled transcript outcomes with the real local embedding/search engine. It can download model weights, creates an isolated temporary browser profile, and does not use your normal browser history or cookies.

After pulling merged changes, run `pnpm run setup` if dependencies or the runtime build changed. Reload the extension, reopen its settings page, and refresh YouTube tabs. Keeping the checkout folder path stable preserves its extension identity. Export your index before switching to another folder or removing an installation.
