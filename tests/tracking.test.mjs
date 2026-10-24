import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validCoordinates,
  busState,
  movement,
  bearing,
  gpsFix,
  ageLabel,
  distanceMeters,
} from "../js/tracking.js";
import { validateGeometry, CAMPUSES } from "../js/routes.js";
const now = 1_790_000_000_000;
const bus = {
  status: "ONLINE",
  tripStarted: true,
  latitude: 7.82,
  longitude: 6.7,
  accuracy: 8,
  lastGpsUpdate: now,
  lastHeartbeat: now,
};
test("coordinates reject null, strings, non-finite values and out-of-range values", () => {
  for (const [lat, lng] of [
    [null, 6],
    ["7.8", 6],
    [91, 6],
    [7, 181],
    [NaN, 6],
    [7, Infinity],
  ])
    assert.equal(validCoordinates(lat, lng), false);
  assert.equal(validCoordinates(0, 0), true);
});
test("live status requires both fresh GPS and heartbeat, valid coordinates and acceptable accuracy", () => {
  assert.equal(busState(bus, now).live, true);
  for (const patch of [
    { lastHeartbeat: now - 26000 },
    { lastGpsUpdate: now - 31000 },
    { lastGpsUpdate: now + 6000 },
    { latitude: null },
    { accuracy: 101 },
    { accuracy: -1 },
    { accuracy: undefined },
    { tripStarted: false },
  ])
    assert.equal(busState({ ...bus, ...patch }, now).live, false);
  assert.equal(busState(bus, now, false).live, false);
  assert.equal(
    busState({ ...bus, lastGpsUpdate: now - 31000 }, now).key,
    "stale",
  );
});
test("heading follows real movement, ignores stationary jitter and rejects implausible jumps", () => {
  assert.ok(Math.abs(bearing([0, 0], [0, 1]) - 90) < 0.001);
  const previous = { ...bus, lastGpsUpdate: now - 5000 };
  const east = { ...bus, longitude: 6.7003, speed: 6 };
  assert.ok(Math.abs(movement(previous, east, now).heading - 90) < 1);
  assert.equal(movement(previous, east, now).animate, true);
  for (const patch of [
    { longitude: 6.70001 },
    { speed: 0 },
    { longitude: 7 },
    { lastGpsUpdate: now - 6000 },
  ])
    assert.equal(movement(previous, { ...east, ...patch }, now).moving, false);
  assert.equal(movement(previous, { ...east, heading: 245 }, now).heading, 245);
  assert.equal(
    movement(previous, { ...east, heading: 245, speed: null }, now).heading >
      89,
    true,
  );
});
test("GPS accepts original fresh capture time only and preserves unknown speed/heading", () => {
  const position = {
    timestamp: now - 1000,
    coords: {
      latitude: 7.8,
      longitude: 6.7,
      accuracy: 12,
      speed: null,
      heading: null,
    },
  };
  assert.equal(gpsFix(position, now, 2000).lastGpsUpdate, now + 1000);
  assert.equal(gpsFix(position, now).speed, null);
  assert.equal(gpsFix({ ...position, timestamp: now - 11000 }, now), null);
  assert.equal(
    gpsFix({ ...position, coords: { ...position.coords, accuracy: 200 } }, now),
    null,
  );
});
test("age labels do not make a future timestamp appear fresh", () => {
  assert.equal(ageLabel(now + 6000, now), "Invalid timestamp");
  assert.equal(ageLabel(null, now), "Not received");
  assert.equal(ageLabel(now - 35000, now), "35s ago");
});
test("geometry rejects fabricated straight lines, malformed data and routes outside the campus region", () => {
  assert.equal(validateGeometry(null), null);
  assert.equal(
    validateGeometry(CAMPUSES.map((c) => [c.coordinates[1], c.coordinates[0]])),
    null,
  );
  assert.equal(
    validateGeometry([
      [0, 0],
      [1, 1],
    ]),
    null,
  );
  assert.equal(
    validateGeometry([
      [6.7, "7.8"],
      [6.8, 7.9],
    ]),
    null,
  );
  assert.ok(
    distanceMeters(CAMPUSES[0].coordinates, CAMPUSES[1].coordinates) > 8000,
  );
});
