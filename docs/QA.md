# Development verification — 24 October 2026

## Completed checks

- Homepage reviewed visually in Chrome, with desktop, 390px mobile, and 320px screenshots.
- Homepage, student tracker, and unavailable driver portal checked at 1440px, 820px, 390px, and 320px. No horizontal overflow or JavaScript page errors; automated WCAG A/AA checks pass for these states.
- Twelve unit tests cover GPS validation/freshness, direction, jitter, implausible jumps, capture timestamps, route rejection, trip start/end, write throttling, permission denial, connection loss/reconnect, write failure, cancellation during startup, and failed end confirmation.
- Seven browser scenarios cover responsive/accessibility behavior, disabled Firebase making zero Firebase requests, true empty states, bus selection, live/stationary/stale markers, network loss/reconnect, invalid route rejection, and compatibility URLs.
- OpenStreetMap tiles and actual campus positions were visually inspected. No production bus records were read or written.

## Additional checks in progress

- Driver UI tests with an explicitly isolated Firebase test double exercise credential feedback, authorized-bus display, start/end confirmation, permission denial, and reconnect. Test doubles are not evidence of database authorization enforcement.
- Proposed Realtime Database rules have emulator tests for anonymous access, per-bus authorization, private assignments, malformed writes, stale GPS, and old-session disconnect protection. Record the actual emulator result here before release.

## Required external acceptance

Real Firebase configuration and accounts, deployed security rules, hosting publish directory, actual mobile GPS/background behavior, and official campus route data are not confirmed. Automated browser accessibility checks do not replace keyboard and screen-reader acceptance. No production deployment is authorized or performed.
