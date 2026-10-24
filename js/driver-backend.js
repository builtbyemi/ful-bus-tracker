// All writes go through an authenticated, administrator-assigned bus reference.
// Matching database rules are in database.rules.json; client checks alone are not security.
import { timestamp } from "./tracking.js";
export function createDriverBackend(client, busId) {
  const { db, database } = client;
  const reference = db.ref(database, "buses/" + busId);
  const stopped = (sessionId) => ({
    sessionId,
    status: "OFFLINE",
    tripStarted: false,
    lastHeartbeat: db.serverTimestamp(),
  });
  return {
    async claim(sessionId, routeId) {
      const result = await db.runTransaction(
        reference,
        (current) => {
          if (current?.tripStarted === true) return; // Stale sessions need explicit recovery below.
          return {
            busId,
            schemaVersion: 2,
            sessionId,
            status: "STARTING",
            tripStarted: true,
            lastHeartbeat: db.serverTimestamp(),
            ...(routeId ? { routeId } : {}),
          };
        },
        { applyLocally: false },
      );
      if (!result.committed)
        throw new Error(
          "This bus already has an active trip. End it on the other device, or recover the trip after its connection expires.",
        );
    },
    async recover(now) {
      const result = await db.runTransaction(
        reference,
        (current) => {
          // A no-op still reaches the server and retries if this cached idle
          // record changed. Aborting here would skip that server comparison.
          if (current?.tripStarted === false && current.schemaVersion === 2)
            return current;
          const lastActivity = Math.max(
            0,
            ...["lastHeartbeat", "lastGpsUpdate", "lastSeen", "timestamp"].map(
              (key) => timestamp(current?.[key]) || 0,
            ),
          );
          if (now - lastActivity <= 45_000) return;
          // Normalize old records instead of copying legacy fields rejected by schema v2.
          return {
            busId,
            schemaVersion: 2,
            sessionId: crypto.randomUUID(),
            status: "OFFLINE",
            tripStarted: false,
            lastHeartbeat: db.serverTimestamp(),
          };
        },
        { applyLocally: false },
      );
      if (!result.committed)
        throw new Error(
          "Recovery is only available after the previous connection has been inactive for 45 seconds.",
        );
    },
    arm(sessionId) {
      // Register a complete valid record: onDisconnect.update checks child writes
      // separately, which conflicts with the cross-field trip/status validation.
      return db.onDisconnect(reference).set({
        busId,
        schemaVersion: 2,
        ...stopped(sessionId),
      });
    },
    write(sessionId, fix) {
      return db.update(reference, {
        ...fix,
        sessionId,
        status: "ONLINE",
        tripStarted: true,
        lastHeartbeat: db.serverTimestamp(),
      });
    },
    heartbeat(sessionId) {
      return db.update(reference, {
        sessionId,
        lastHeartbeat: db.serverTimestamp(),
      });
    },
    async end(sessionId) {
      await db.update(reference, stopped(sessionId));
      await db.onDisconnect(reference).cancel();
    },
  };
}
