# Contributing

Thanks for helping improve Bili Balance. Small, reviewable changes make the permission, privacy and platform boundaries easier to verify.

## Before opening a pull request

1. Open an issue describing the user-visible problem or proposed behavior.
2. Keep features local-first and offline. Do not add platform API calls, analytics, remote code, ad matching, feed-card filtering, account data, or unrelated site access.
3. Keep Bilibili's existing DOM read-only. Build the interface in the extension-owned Shadow DOM.
4. Add or update a focused Node built-in test for changed behavior.
5. Run `node scripts/check.mjs` and `node scripts/package.mjs`.
6. Preview UI changes with `node scripts/serve-preview.mjs`, and document any manual Chrome verification that is still needed.
7. Update the privacy notice and release notes if behavior, permissions or stored data changes.

No dependency installation is needed. Node.js 20 or newer is sufficient. The project intentionally has no formatter, framework or bundler.

## Architecture

- `src/shared/` contains reusable rules and local state logic.
- `src/background/service-worker.js` validates messages and sender context, handles Chrome APIs, and updates local aggregates.
- `src/content/content.js` reads only the current page and reports foreground playback.
- `src/content/panel/` contains the floating UI's isolated styles and view.
- `src/content/floating-panel.js` coordinates the floating UI state and events.
- `src/popup/view.js` renders the popup without depending on Chrome APIs; `popup.js` owns actions and receives a request function.
- `docs/fixtures.js` supplies synthetic preview data. It is not part of the extension package.

Content scripts are classic scripts, and their registration order in `manifest.json` is intentional. The popup and background worker use native ES modules.

## Pull requests

Describe the behavior before and after the change, relevant permissions or data impact, test results, and any remaining manual checks. Include screenshots for visible UI changes when useful. Do not include profile data, watch history or other personal information.

## Releases

Keep the versions in `package.json` and `manifest.json` aligned. Update `CHANGELOG.md` and `docs/release-checklist.md`, run the checks and create the extension ZIP with `node scripts/package.mjs`. Review the resulting `dist/` package before publishing it.
