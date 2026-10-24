# Development verification — 24 October 2026

## Completed checks

- Homepage reviewed visually in Chrome, with desktop, 390px mobile, and 320px screenshots.
- Homepage, student tracker, and unavailable driver portal checked at 1440px, 820px, 390px, and 320px. No horizontal overflow or JavaScript page errors; automated WCAG A/AA checks pass for these states.
- `npm test`: **15 passing** unit tests cover GPS validation/freshness, direction, jitter, implausible jumps, capture timestamps, route rejection, trip start/end, write throttling, permission denial, connection loss/reconnect, write failure, startup cancellation, failed end confirmation, and delayed errors from previous trips.
- Browser tests: **22 scenarios passed across the initial and targeted reruns**, using installed Chrome. Eight interface scenarios cover responsive/accessibility behavior, disabled Firebase making zero Firebase requests, empty states, bus selection, live/stationary/stale markers, network loss/reconnect, invalid routes, compatibility URLs, and denied database reads. Four driver scenarios cover credentials, assignment, trip lifecycle, permission denial, and reconnection. Ten dark-mode scenarios cover all three screens at 1440/390/320px and persistent manual preference.
- The first dark-mode run timed out waiting for external fonts/tiles. Those tests now isolate external resources and check one page per scenario; all ten pass. Screenshots are in ignored `artifacts/`.
- `npm run check`: syntax and local references pass for **46 files**. `git diff --check` passes.
- A read-only production `/buses.json?shallow=true` request returned **HTTP 401**. No production data, Authentication settings, rules, or deployment configuration were modified. The existing `js/config.js` checksum is unchanged.

## Firebase emulator verification

- `npm run test:rules` launches only local Auth/Realtime Database emulators with project `demo-ful-bus-tracker`. Tests use hard guards requiring localhost ports 9000/9099. Java 21 is available under ignored `.local-tools/`; the runner also supports system Java. No Firebase sign-in is required for the emulator suite.
- The emulator exposed a real startup blocker: partial `onDisconnect.update` registration failed cross-field validation. Complete offline-record registration fixed it. It also exposed a stale local-cache recovery abort, now handled by allowing the transaction to compare with server state.
- Final `npm run test:rules`: **10 passing, 0 failing** (six authorization/validation tests and four Auth/backend integration tests). Verified real emulator login, private assignment access, exclusive trip claim, GPS writes, heartbeat, trip ending, server disconnect cleanup, stale legacy recovery, and successive GPS updates reaching an unauthenticated student listener. Expected `permission_denied` messages in the test log are deliberate rejected-write assertions. The demo namespace/default-instance warning does not indicate production access; both namespaces are local demo instances.

## Dependency audit

The available `npm audit` report lists 10 findings (5 high, 5 moderate) in development dependencies, including Firebase's unused Firestore/gRPC packages and Firebase CLI transitive dependencies. Automated fixes propose major-version downgrades; those were not applied to the working Auth/RTDB stack. The browser loads only Firebase App/Auth/Realtime Database modules, not the npm Firestore/CLI packages. This is an outstanding tooling dependency review, not a clean audit result.

## Required external acceptance

The user supplied configuration and confirmed driver login. Production rules have not been published or inspected in Console, so real driver writes and production student subscriptions remain unverified. Real mobile GPS/background behavior, the hosting publish directory, and official campus route data still require manual acceptance. Automated browser accessibility checks do not replace keyboard and screen-reader checks. No production deployment was performed. Follow [the Firebase setup guide](FIREBASE_SETUP.md).
