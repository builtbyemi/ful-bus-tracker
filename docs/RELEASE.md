# Configuration and controlled release

## Current release status

This is a local development candidate on `dev`. The supplied Firebase configuration is preserved, and the user has confirmed working driver login and added an assignment. A read-only production bus request returned HTTP 401; deployed rules have not been inspected through Console or changed. Hosting settings, real-device GPS operation, and university route details remain unconfirmed. No production data, Auth settings, database rules, deployment settings, branches, or releases have been changed remotely. See [Firebase Console setup](FIREBASE_SETUP.md).

## Before enabling Firebase

1. Keep the existing public configuration in `js/config.js`. Check that Firebase Console shows the same project and exact Realtime Database URL. Change a value only if Console establishes that it is incorrect.
2. Verify the hosting publish directory and preview environment. The root is the maintained source directory, but this does not prove the current hosting root. Legacy redirects under `bus-tracking-platform/` assume the complete repository layout remains reachable; they are not an independently deployable copy.
3. Review existing production data/rules and plan compatibility with the new schema before proposing any rules deployment. Back up the data and current rules through administrator tooling. Legacy telemetry may remain readable, but new writes require the schema below. Any migration or production cleanup needs explicit approval.
4. Keep the already-working email/password Authentication and existing driver account. The administrator can review and publish the proposed database rules using the setup guide. No public sign-up form or shared password is included.
5. Create a private `drivers/{firebaseAuthUid}/busId` assignment for each driver, containing one of `FUL-001`, `FUL-002`, `FUL-003`. Use one assigned account per bus. These records are administrator-managed; frontend clients cannot write assignments. Drivers can read only their own assignment. Students read only bus telemetry.
6. Retire the old public-password workflow and treat all historical shared passwords as compromised. Removing them from the working tree does not erase Git history or deployed old copies. The authentication migration and old-client retirement must be coordinated.

These are future release steps, not changes performed by this work. Review the concrete rules file and configuration diff before authorizing production actions. There is deliberately no production deploy script or changed hosting configuration.

## Proposed telemetry contract

`buses/{busId}` remains the public telemetry path. It contains no driver identity, email, or password.

| Field                               | Meaning                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `busId`, `schemaVersion`            | Known bus ID and schema version `2`                                                   |
| `sessionId`                         | Random trip identifier, not an authentication secret                                  |
| `status`                            | `STARTING`, `ONLINE`, or `OFFLINE`                                                    |
| `tripStarted`                       | Explicit trip activity flag                                                           |
| `lastHeartbeat`                     | Server timestamp, independent of GPS capture                                          |
| `latitude`, `longitude`, `accuracy` | Accepted GPS fix and accuracy in metres                                               |
| `lastGpsUpdate`                     | Original device capture time adjusted by Firebase server-time offset                  |
| `heading`, `speed`                  | Optional device heading in degrees / speed in metres per second                       |
| `routeId`                           | Optional driver-selected `adankolo-felele` connection; not proof of official geometry |

The rules deny anonymous writes, writes to another driver’s bus, self-assignment, record deletion, unknown fields, malformed coordinates, invalid speeds/headings, stale new GPS fixes, and implausible future timestamps. Full-node validation protects required fields even when a client attempts a child deletion. Heartbeats cannot change GPS age. A stale disconnect from an old trip cannot overwrite a replacement trip’s session.

The driver claims a trip transactionally, registers a complete offline record for disconnect cleanup, then starts GPS. A second tab cannot claim an active trip. Explicit recovery is offered after 45 seconds without activity across heartbeat, GPS, and legacy timestamps; it normalizes legacy records. After connection loss, old coordinates are not automatically reused to resume tracking.

## Manual acceptance on a preview deployment

- Confirm sign-in, wrong-password feedback, unassigned-driver state, and assignment revocation with test accounts.
- Confirm direct SDK/REST writes are denied for unauthenticated and wrong-bus clients under the deployed preview rules.
- On actual Android and iOS devices, test permission denial, accurate/stationary/moving GPS, screen lock, backgrounding, signal loss, and reconnect. Browser emulation cannot establish real-device GPS or operating-system background behavior.
- Open two sessions for one assigned bus. Verify only one trip starts, an old disconnect does not end a replacement, and stale session recovery works.
- Check an ended trip becomes offline and the page stops requesting GPS. Check dashboard success timestamps advance only after acknowledged writes.
- Verify geographic coordinates and official stop order with the university before making route, upcoming-stop, distance, or ETA claims. Supply reviewed geometry before setting `VERIFIED_ROUTE`.
- Verify map tile and routing provider usage policies/capacity for the expected traffic. No service-level guarantee is assumed for public OpenStreetMap tiles or the OSRM demo service.
- Review HTTPS, caching and security headers on the confirmed hosting platform, preview smoke tests, and rollback procedures. Hosting configuration is intentionally not changed here.
- Approve the production configuration/rules/deployment as a separate final step after preview acceptance.

## References

- [Firebase presence, disconnect cleanup, and server-time offset](https://firebase.google.com/docs/database/web/offline-capabilities)
- [Realtime Database authorization and validation](https://firebase.google.com/docs/database/security/rules-conditions)
- [Local emulator setup](https://firebase.google.com/docs/emulator-suite/install_and_configure)
