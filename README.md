# FUL Bus Tracker

University bus tracking using the existing HTML, CSS, JavaScript, Leaflet, and Firebase stack. Work is on `dev`; no deployment or production Firebase changes are included.

## Local preview

Node 20 or newer:

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:4173**. `index.html` is the homepage, `track.html` is the student map, and `driver.html` is the maintained driver portal. Existing URLs, including `Driver/driver.html`, remain compatibility redirects. The production publish directory is **not yet verified**.

Firebase is intentionally disabled until verified public configuration is supplied in [js/config.js](js/config.js). The default preview shows campus locations and an honest tracking-unavailable state. It does not generate bus locations, call Firebase, or permit driver sign-in. Map tiles require internet access; map controls and Leaflet assets are local. The font has a system fallback.

## Project layout

- `shared.css`: FUL palette, typography, navigation, focus states, shared components.
- `style.css`, `track.css`, `driver.css`: screen-specific layouts.
- `js/tracking.js`: coordinate validation, GPS freshness, movement, headings, and write cadence.
- `js/markers.js`: custom SVG markers; interpolation only between accepted GPS fixes.
- `js/routes.js`: existing campus coordinates, optional validated OSRM road reference.
- `js/firebase-client.js`: one Firebase initialization and cleaned-up fleet subscriptions.
- `js/driver-backend.js`, `js/trip-controller.js`: assigned-bus writes and GPS trip lifecycle.
- `database.rules.json`: **proposed, undeployed** authorization and validation rules.
- `firebase.emulators.json`: local emulator configuration only, using a `demo-` project.
- `tests/`: deterministic unit, browser, and database authorization checks. Simulated GPS exists only here.
- [docs/AUDIT.md](docs/AUDIT.md): original architecture, duplicated code, risks, and phased implementation.
- [docs/RELEASE.md](docs/RELEASE.md): configuration, provisioning, limitations, and release gates.

## Tests

```sh
npm test
npx playwright install chromium
npm run test:browser
npm run test:rules
```

Database tests require Java 21+ and the Firebase CLI installed by `npm install`. They launch only local Authentication/Realtime Database emulators with project ID `demo-ful-bus-tracker`. There is no test command that targets the production project.

To use an existing Chrome installation in PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:browser
```

Browser screenshots are saved under ignored `artifacts/`; failed test traces are under ignored `test-results/`. Browser tests intercept Firebase configuration or transport exclusively in their own contexts. Never publish test fixtures as an application entry point.

## Location and route behavior

A bus is live only during an active trip, with a heartbeat at most 25 seconds old, GPS at most 30 seconds old, valid coordinates, and accuracy of 100 metres or better. Device speed/heading is used only when trustworthy; otherwise a bearing requires movement above the GPS uncertainty and a plausible speed. No extrapolation is performed. Stationary fixes do not animate. Ended trips disappear; interrupted locations are gray and removed after five minutes. Student network loss immediately removes the live designation.

GPS writes are limited to one per five seconds and heartbeats to one per ten seconds, with no unbounded write queue. GPS capture time is preserved separately from server heartbeat time. Disconnects stop local tracking and require confirming the old trip’s end before starting again. Closing the page uses a server-registered disconnect handler.

Adankolo and Felele campus coordinates are retained from the existing project. The intermediate routing point is not presented as a bus stop. Optional OSRM geometry is checked for coordinate ranges, endpoints, gaps, and plausible total length, and is always labeled a **driving reference** unless independently reviewed. There are no invented stops, timetables, or arrival estimates.

Leaflet 1.9.4 is vendored under `assets/vendor/leaflet/` with its license. University crest files retain their original appearance. OpenStreetMap attribution remains visible.
