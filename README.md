# Bili Balance

**Bili Balance** is a local-first Manifest V3 Chrome extension for tracking foreground video viewing on Bilibili. It summarizes the current video's tags, separates viewing time into study and recreation, and reminds you about daily limits and continuous recreation.

> This project does not promise compatibility with Bilibili's terms or account enforcement. It is not affiliated with or endorsed by Bilibili.

## Features

- Draggable, collapsible floating panel and separate toolbar popup.
- Local topic summary from tags displayed on the current video page, falling back to its title.
- Separate study and recreation totals, retained locally for the last 30 calendar days.
- Daily recreation reminder adjustable from 0 to 720 minutes; zero disables this reminder only.
- A separate 25-minute continuous recreation reminder that carries across recreation videos, Bilibili tabs, refreshes and service-worker restarts. Learning playback, pausing tracking, clearing history, or about 60 seconds without a foreground playback report ends the session.
- Session-only manual category correction, a global tracking pause and a two-click history clear.
- Independent previews for both interfaces with synthetic data and no Bilibili connection.

Time is estimated from the local `<video>` element. Playback speed does not multiply recorded time. Paused, seeking, stalled, hidden and unfocused intervals are excluded. Closing the browser can lose the last few unsaved seconds.

This release does **not** hide feed cards, block ads, read account identifiers, access Bilibili APIs, or change playback or youth-protection settings.

## Install for local testing

1. Download or clone this repository.
2. Open `chrome://extensions` and enable Developer mode.
3. Choose **Load unpacked** and select the folder containing `manifest.json`.
4. Open or refresh a Bilibili video page. The panel appears in the lower-right corner. Use the toolbar icon for the popup.

After code changes, reload the extension and refresh the Bilibili tab. `activeTab` cannot replace the site permission because playback measurement and the panel start automatically when a page loads.

## Develop and preview

Requires Node.js 20+. There are no third-party dependencies or extension build step.

```sh
node scripts/check.mjs
node scripts/package.mjs
node scripts/serve-preview.mjs
```

The preview server binds only to `127.0.0.1`. Visit `http://127.0.0.1:8765/docs/preview.html` for the floating panel, or `http://127.0.0.1:8765/docs/popup-preview.html` for the toolbar popup. Both use production UI modules with synthetic local data; they do not use Chrome storage or contact Bilibili. The preview serves only `src/` and `docs/` files.

When npm is available, `npm run check`, `npm run package` and `npm run preview` are equivalent shortcuts.

## Project layout and extension points

```text
src/
  background/       MV3 worker, message validation and local aggregation
  content/
    content.js      Current-page metadata and playback coordination
    playback-clock.js
    panel/styles.js Floating panel Shadow DOM styles
    panel/view.js   Floating panel structure and controls
    floating-panel.js  Floating panel state and interactions
  popup/
    popup.html, popup.css
    view.js         Rendering independent from Chrome messaging
    popup.js        Popup actions and injected request transport
    index.js        Chrome-only entry point
  shared/           Classification, storage, duration and usage rules
tests/              Node built-in test runner
docs/               Product notes, risk checks and UI previews
scripts/             Validation, local preview and packaging
```

Restyle the floating panel in `src/content/panel/styles.js`; add or rearrange controls in `panel/view.js`; change its state or interactions in `floating-panel.js`. For the popup, edit `popup.css`, `popup.html` or `view.js`, and keep Chrome message handling in `popup.js`.

Content scripts are classic scripts. Their order in `manifest.json` is part of the UI contract: styles, panel view, panel controller, then the page coordinator. Keep them self-contained and offline. The popup and service worker use ES modules. Add regression tests for behavior changes.

Put pure feature rules in `src/shared/`, storage and tab checks in the service worker, and page reading in the content script. Request only the permissions a feature needs. Update the [privacy notice](PRIVACY.md), product notes, changelog and tests if data or behavior changes.

See [CONTRIBUTING.md](CONTRIBUTING.md), [privacy notice](PRIVACY.md), [platform risk self-check](docs/legal-risk-self-check.md) and [release checklist](docs/release-checklist.md).

## Permissions and data

The extension requests only `storage` and `https://www.bilibili.com/*`. It locally records date, study/recreation seconds, daily limit, timer state, daily warning state and one short-lived continuous-session snapshot. It does not upload or sync data. Current-page titles, tags and identifiers are temporary and are not saved as viewing history. See [PRIVACY.md](PRIVACY.md).

These boundaries reduce data collection and page changes; they cannot establish platform approval or guarantee against account restrictions. Read the [remaining risks](docs/legal-risk-self-check.md) before distributing.

## License

Licensed under the [MIT License](LICENSE). Review the licenses for assets added to this repository.
