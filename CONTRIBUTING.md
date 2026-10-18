# Working on CueWoven

## Build from source

Use Node.js 22+ and pnpm 11.25.0. Run `pnpm install --frozen-lockfile --ignore-scripts` followed by `pnpm run vendor` on a fresh clone, then load the repository root as an unpacked extension. The generated `vendor/` runtime is required but stays out of Git.

## Make a change

Make small changes on a branch, run `pnpm test`, and open a pull request. Check the affected behavior in the browser too: Node tests do not prove live YouTube caption availability. Content scripts require refreshing YouTube tabs after reloading the extension. Rebuild with `pnpm run vendor` after changing `scripts/embedder-entry.js`, `scripts/vendor.mjs`, or the dependency graph.

Keep video metadata, transcript validation, original watch dates, optional site permissions and backup recovery intact. Do not commit watch history, CueWoven backups, browser profiles, cookies, credentials, model weights or generated bundles. No personal YouTube API key is required.

## Browser checks

For the optional browser regression, install Playwright separately from the project's production dependencies. Set `RECALL_PLAYWRIGHT` to its module path and `RECALL_BROWSER` to a Chromium executable that supports loading unpacked extensions, then run:

```sh
node tests/browser/backup-simplification.cjs
node tests/browser/refine-search.cjs
node tests/browser/single-video.cjs
node tests/browser/enter-search.cjs
node tests/browser/background-transcripts.cjs
node tests/browser/adaptive-scenes.cjs
```

These use controlled YouTube/transcript outcomes with the real local embedding/search engine. They can download model weights, create isolated temporary browser profiles, and do not use your normal browser history or cookies. The background test uses the real service worker and temporary tabs to verify processing continues after settings closes.

After pulling merged changes, run `pnpm run setup` if dependencies or the runtime build changed. Reload the extension, reopen its settings page, and refresh YouTube tabs. Keeping the checkout folder path stable preserves its extension identity. Export your index before switching to another folder or removing an installation.

## Package a download

Run `pnpm run zip` after building the runtime. The ZIP includes `vendor/` and can be loaded after extraction; GitHub source archives need a build. Inspect the archive before attaching it to a release. Keep the version in `manifest.json` and `package.json` consistent and describe user-facing behavior in release notes, rather than adding a running changelog to the README.

## Collaboration

Create a branch from current main, commit your work, push the branch and open a pull request. Teammates pull after merge and reload their installed checkout. Content-script changes also need a page refresh. Owner/admin permissions can differ from contributor permissions; follow the repository's active rules.

Keep commit history intact and describe project provenance truthfully in hackathon submissions. Do not rewrite dates or claim a build timeline solely from test counts or this documentation. Never include personal browser screenshots, history exports, tokens or library backups in a PR.
