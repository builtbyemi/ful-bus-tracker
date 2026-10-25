# Repository audit — 24 October 2026

## Existing architecture

The checked-out branch is `dev`. This is a static, unbundled HTML/CSS/JavaScript application, with Leaflet 1.9.4 and Firebase browser ES modules. The root homepage links to `track.html` and `Driver/driver.html`. This establishes the local navigation entry points, **not the production hosting root**, which remains unconfirmed. No hosting configuration, Firebase rules, tests, or build scripts were supplied.

`track.js` subscribes to `buses`; driver scripts write `buses/{busId}`. Existing fields include `busId`, `status`, `tripStarted`, `latitude`, `longitude`, `accuracy`, `lastGpsUpdate`, `lastHeartbeat`, `lastSeen`, and `timestamp`. Heartbeats and GPS were separate, but marker visibility did not consistently require fresh GPS. Client timestamps, unrestricted coordinate coercion, and repeated popup updates made state less reliable.

## Security and reliability findings

- Driver passwords were embedded in four publicly served scripts; a URL parameter selected the bus. This is not authentication or authorization. Treat the old passwords as compromised. Historical copies remain in Git history.
- No database rules were checked in. Actual deployed permissions cannot be inferred from this repository.
- The tracking and driver scripts disagree on the Firebase API key; no verified database URL was supplied. Firebase web identifiers are public, but must be correct. Do not guess configuration or connect to production during development.
- Driver writes ran before authentication and used destructive full-node replacements. GPS and connection failures did not reliably stop or qualify tracking.
- The OSRM route is a general driving route through three existing coordinates, not verified university route geometry. There is no confirmed stop order, timetable, or ETA model.
- The homepage uses a dark/green theme, the map references a missing image, and driver pages use inconsistent assets. The new supplied crest is an 85px asset suitable for small, proportion-preserving display.
- Analytics imports a bare npm specifier directly in the browser without a bundler. It cannot run as written.

## Duplicate and unused files

`bus-tracking-platform/` is an older application copy with its own pages, assets, and driver logic. Root `driver.*` duplicates `Driver/driver.*`, but the root HTML loads its ES module as a classic script. `routes.html`, `busstops.html`, and `tracker.html` are empty placeholders in both trees. `script.js` is effectively empty. `analytics/dist/` and tracked `node_modules/` contain library output. Their deployment role is unconfirmed, so assets and library output are retained. Legacy HTML URLs will become explicit compatibility entry points to the maintained root application; obsolete password-bearing scripts will become harmless module wrappers. A release requires verifying the actual hosting root.

Pre-existing user changes: deletion of `images/bus-2.png`, and newly supplied crest and branding screenshot. Preserve these changes.

## Minimum structural changes and verification sequence

1. Keep static pages, Leaflet, the `dev` branch, and existing bus IDs/database path. Centralize Firebase configuration; leave the connection disabled until verified.
2. Introduce a shared design system, supplied crest, accessible navigation, and responsive homepage. Verify links and mobile/desktop layouts.
3. Add a map-focused student page, clear unavailable/loading/empty states, and an expandable mobile information panel.
4. Extract pure GPS/freshness/heading logic, bounded interpolation, and route validation. Verify with automated unit and browser tests; simulated data belongs only in tests.
5. Replace password checks with Firebase email/password Authentication, administrator-owned bus assignments, and local proposed Realtime Database rules. Test authorization and lifecycle in emulators if available. Never deploy these rules or modify production Auth/data without approval.
6. Run responsive, accessibility, lifecycle, and security checks; document limitations and a controlled release checklist. Production hosting settings, Firebase identifiers, real driver accounts, device GPS, and official routes require later verification.

Implementation references: [Firebase presence and server time](https://firebase.google.com/docs/database/web/offline-capabilities), [Realtime Database authorization and validation](https://firebase.google.com/docs/database/security/rules-conditions).
