import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== "127.0.0.1:9000")
  throw new Error("Rules tests require the localhost demo emulator.");
let environment, driver, other, anonymous;
const session = "11111111-1111-4111-8111-111111111111";
const secondSession = "22222222-2222-4222-8222-222222222222";
function record(patch = {}) {
  return {
    busId: "FUL-001",
    schemaVersion: 2,
    sessionId: session,
    status: "ONLINE",
    tripStarted: true,
    latitude: 7.82,
    longitude: 6.7,
    accuracy: 8,
    lastGpsUpdate: Date.now(),
    lastHeartbeat: Date.now(),
    ...patch,
  };
}
before(async () => {
  environment = await initializeTestEnvironment({
    projectId: "demo-ful-bus-tracker",
    database: {
      host: "127.0.0.1",
      port: 9000,
      rules: await readFile("database.rules.json", "utf8"),
    },
  });
  driver = environment.authenticatedContext("driver-one").database();
  other = environment.authenticatedContext("driver-two").database();
  anonymous = environment.unauthenticatedContext().database();
});
beforeEach(async () => {
  await environment.clearDatabase();
  await environment.withSecurityRulesDisabled(async (context) =>
    context
      .database()
      .ref("drivers")
      .set({
        "driver-one": { busId: "FUL-001" },
        "driver-two": { busId: "FUL-002" },
      }),
  );
});
after(async () => environment?.cleanup());
test("students can read bus data, but cannot write buses or read driver assignments", async () => {
  await assertSucceeds(anonymous.ref("buses").once("value"));
  await assertFails(anonymous.ref("buses/FUL-001").set(record()));
  await assertFails(anonymous.ref("drivers/driver-one").once("value"));
});
test("assigned driver can write only their bus and cannot grant an assignment", async () => {
  await assertSucceeds(driver.ref("drivers/driver-one/busId").once("value"));
  await assertSucceeds(driver.ref("buses/FUL-001").set(record()));
  await assertFails(
    driver.ref("buses/FUL-002").set(record({ busId: "FUL-002" })),
  );
  await assertFails(
    other
      .ref("buses/FUL-001")
      .update({ status: "OFFLINE", tripStarted: false }),
  );
  await assertFails(driver.ref("drivers/driver-one/busId").set("FUL-002"));
  await assertFails(driver.ref("drivers/driver-two").once("value"));
});
test("invalid GPS, timestamps, unknown fields, deletes, and inconsistent state are rejected", async () => {
  for (const patch of [
    { latitude: "7.82" },
    { longitude: 181 },
    { accuracy: 200 },
    { lastGpsUpdate: Date.now() + 60000 },
    { lastGpsUpdate: Date.now() - 60000 },
    { password: "not-allowed" },
    { tripStarted: false },
    { sessionId: "x" },
    { heading: 360 },
    { speed: 100 },
  ]) {
    await assertFails(driver.ref("buses/FUL-001").set(record(patch)));
  }
  await assertSucceeds(driver.ref("buses/FUL-001").set(record()));
  await assertFails(driver.ref("buses/FUL-001").remove());
  await assertFails(driver.ref("buses/FUL-001/latitude").remove());
});
test("heartbeat cannot refresh stale GPS; regressing timestamps are denied", async () => {
  const old = record({ lastGpsUpdate: Date.now() - 60000 });
  await environment.withSecurityRulesDisabled((context) =>
    context.database().ref("buses/FUL-001").set(old),
  );
  await assertSucceeds(
    driver.ref("buses/FUL-001").update({ lastHeartbeat: Date.now() }),
  );
  const snapshot = await driver.ref("buses/FUL-001").once("value");
  assert.equal(snapshot.val().lastGpsUpdate, old.lastGpsUpdate);
  await assertFails(
    driver
      .ref("buses/FUL-001")
      .update({ lastGpsUpdate: old.lastGpsUpdate - 1 }),
  );
});
test("old session disconnect cannot end a replacement session", async () => {
  await assertSucceeds(driver.ref("buses/FUL-001").set(record()));
  await assertFails(
    driver
      .ref("buses/FUL-001")
      .set(record({ sessionId: secondSession, status: "STARTING" })),
  );
  await assertSucceeds(
    driver
      .ref("buses/FUL-001")
      .update({ status: "OFFLINE", tripStarted: false }),
  );
  await assertSucceeds(
    driver
      .ref("buses/FUL-001")
      .set(record({ sessionId: secondSession, status: "STARTING" })),
  );
  await assertFails(
    driver
      .ref("buses/FUL-001")
      .update({ sessionId: session, status: "OFFLINE", tripStarted: false }),
  );
});
