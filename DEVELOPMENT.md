# Development

Requires Node.js 24 or newer. Install dependencies with `npm ci`, then run `npm run dev`.

- `npm run check`: syntax-check all source and test modules.
- `npm run format` / `npm run format:check`: format or check source formatting.
- `npm test`: protocol, transport, state, and production-build tests.
- `npx playwright install chromium`, then `npm run test:browser`: demo and simulated USB browser checks. The runner starts and stops its own local server.
- `npm run test:browser -- --production`: build and browser-test the production bundle.
- `npm run build`: generate the GitHub Pages bundle in `dist`.

To use an installed Chrome instead of Playwright's Chromium, set `CHROME_PATH` to its executable. Set `APP_URL` to check an existing local server instead of starting one. The browser tests use an isolated profile and a mock USB device; physical pedal testing is still needed for firmware behavior.

## Code layout

`src/app.js` coordinates pedal operations and application state. `src/ui/` contains panel renderers; they receive state snapshots and action callbacks rather than owning USB writes. `src/effect-metadata.js` defines effect labels and parameter layout. `src/bypass-session.js` retains the original preset context during temporary bypass; confirmed hardware slot restoration belongs to `src/usb.js`, shared by the serial transport. Small modules handle gesture recognition, tap tempo, Division synchronization, and cabinet modes.

GitHub Pages checks syntax, formatting, unit tests, and the browser suite before deploying.

Format source before committing. Keep USB command bytes unchanged during UI refactors, and check both themes, mobile layouts, and the bypass round trip before publishing.
