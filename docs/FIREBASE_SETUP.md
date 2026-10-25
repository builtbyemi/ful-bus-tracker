# Finish Firebase setup

The application is on `dev`. Existing Firebase configuration and `Driver/driver.json` were preserved. Nothing was deployed and no production data, Authentication settings, or rules were changed. The local rules file is a proposal for your review. Working Authentication does not grant Realtime Database access automatically.

## 1. Select the existing project and database

Open [Firebase Console](https://console.firebase.google.com/) and select **ful-bus-tracker**. Go to **Build → Realtime Database** (not Firestore). The URL should match the existing `databaseURL` in `js/config.js`:

`https://ful-bus-tracker-default-rtdb.firebaseio.com`

Keep your existing web app configuration. If Console shows a different database instance, verify which instance holds the assignments before changing anything.

## 2. Verify the driver assignment

1. Open **Build → Authentication → Users**, select the existing driver account, and copy its **User UID**. Keep the account and its working email/password login.
2. In **Realtime Database → Data**, expand `drivers`, then that exact UID.
3. Confirm it has a child named `busId` whose **string** value is `FUL-001` (or `FUL-002` / `FUL-003`). Bus IDs are case sensitive. Do not use the driver's email as the key.

```text
drivers
  <UID copied from Authentication>
    busId: "FUL-001"
```

Your local `Driver/driver.json` records UID `PFzMKMaqJ9VaWpk75cebANY3OCj1` assigned to `FUL-001`; verify that this matches the account and the actual database. A local JSON file does not create a Firebase assignment. Edit only the needed child in Console; importing a replacement JSON file at the database root can overwrite unrelated data. Assign one active driver account per bus.

## 3. Review and publish the database rules yourself

1. Open **Realtime Database → Rules** and save a copy of the current rules.
2. Open the repository's [database.rules.json](../database.rules.json).
3. For a database dedicated to this tracker, copy the **entire file**, including the outer `rules` object, into the Rules editor. If other applications share this database, merge their reviewed rules first rather than replacing their permissions.
4. Review the changes, then click **Publish** when you are ready to apply them. This is the production step; Codex has not performed it.

These rules have no test-mode expiration date. They allow students to read `buses`, allow signed-in drivers to read only their own assignment, and allow each assigned driver to write only their known bus. Clients cannot grant assignments, delete bus records, or write arbitrary fields. Coordinates, timestamps, trip states, and session ownership are checked. Do not replace this with globally open read/write rules. Firebase evaluates database permissions separately from Authentication. [Firebase rules guidance](https://firebase.google.com/docs/database/security/get-started).

After publishing, reload the student page and sign out/in on the driver page: a previously denied listener needs to be recreated.

## 4. Start one real trip

1. Run `npm run dev` and open `http://127.0.0.1:4173/driver.html` on this computer for local testing. Loading the local application uses your configured Firebase project; pressing Start trip will write real telemetry after you publish the rules.
2. Sign in and confirm the displayed bus matches its assignment.
3. On a GPS-equipped device, use a secure **HTTPS** address serving these updated files, or localhost on that device. The development server is loopback-only: a phone cannot use the computer's localhost address. No new phone-accessible HTTPS preview or deployment was created in this task. Plain HTTP over a LAN IP generally cannot use browser geolocation. [Geolocation requirements](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition).
4. Enable device location and precise location if offered. Select the route if applicable, press **Start trip**, and allow location permission. Test in an open area with accuracy of 100 metres or better. Keep the page visible and the screen awake.
5. Wait for **Sharing** and an advancing successful-update time. In Console, `buses/FUL-001` should progress from `STARTING` to `ONLINE`, with `tripStarted: true`, numeric coordinates, accuracy, `lastGpsUpdate`, and `lastHeartbeat`. Do not enter fabricated coordinates to make a bus appear live.

## 5. Check the student map and trip ending

Open `track.html` in another browser or device and select the same bus. It should show **Live**, a marker at the driver's real position, and changing GPS age. Move safely as a passenger or pedestrian; do not operate a phone while driving. Accepted fixes publish at most once every five seconds; heartbeat updates run every ten seconds. Movement direction requires trustworthy GPS movement, so a stationary bus may have no heading.

Press **End trip** and confirm. The database should show `OFFLINE` / `tripStarted: false`, and the student marker should disappear. Test closing the driver tab and losing network access too: server disconnect cleanup ends the trip when Firebase detects the lost connection, while freshness limits prevent old coordinates remaining live. [Firebase disconnect handling](https://firebase.google.com/docs/database/web/offline-capabilities).

## If something still fails

| Symptom                                     | Check                                                                                                                                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login works but assignment access is denied | Rules were published to the correct Realtime Database instance; reload and sign in again.                                                                                                       |
| No bus assigned                             | The Authentication UID exactly matches `drivers/{uid}`, and `busId` is a supported string.                                                                                                      |
| Start/update is denied                      | Project, database URL, assignment, and complete current rules agree. An older deployed client may send fields the new schema rejects.                                                           |
| Another trip is active                      | End it on the original device. If it is abandoned, wait at least 45 seconds after its last activity, then use **Recover disconnected trip** and start again.                                    |
| Locating or weak GPS                        | Enable precise location, use HTTPS/localhost, allow permission, keep the page in front, and wait for a fix within 100 m.                                                                        |
| Student page says access denied             | `buses` must permit public reads in the correct database. Reload after rules changes. If App Check enforcement is enabled, its integration must also be configured; it is not implemented here. |
| GPS stale or connection lost                | GPS older than 30 seconds or heartbeat older than 25 seconds is not live. Heartbeats do not refresh GPS age. Reconnect, finish the interrupted trip, and start again.                           |
| Map is visible but no live bus              | Campus markers are reference locations. A bus appears live only after accepted driver GPS writes; a map alone does not prove tracking is connected.                                             |

Real phone GPS, production rule publication, and deployed-driver/student interoperability still require your manual check. Automated tests use simulated positions and local Firebase emulators; they do not prove hardware GPS or background browser reliability.
