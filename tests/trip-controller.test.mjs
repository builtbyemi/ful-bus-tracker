import { test } from "node:test";
import assert from "node:assert/strict";
import { TripController } from "../js/trip-controller.js";

function setup(overrides = {}) {
  const calls = [],
    states = [];
  let success, failure;
  const backend = Object.fromEntries(
    ["claim", "arm", "write", "heartbeat", "end"].map((name) => [
      name,
      async (...args) => {
        calls.push([name, ...args]);
      },
    ]),
  );
  Object.assign(backend, overrides);
  const geo = {
    watchPosition(ok, fail) {
      success = ok;
      failure = fail;
      return 0;
    },
    clearWatch(id) {
      calls.push(["clear", id]);
    },
  };
  const trip = new TripController({
    backend,
    geolocation: geo,
    onChange: (state) => states.push(state),
  });
  trip.connection(true);
  return {
    trip,
    calls,
    states,
    fix: (patch = {}) =>
      success({
        timestamp: Date.now(),
        coords: {
          latitude: 7.82,
          longitude: 6.7,
          accuracy: 7,
          speed: null,
          heading: null,
          ...patch,
        },
      }),
    error: (code) => failure({ code }),
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
test("failed setup cleanup retains the session so End trip can retry", async () => {
  const { trip } = setup({
    arm: async () => { throw new Error("network lost"); },
    end: async () => { throw new Error("offline"); },
  });
  try {
    await trip.start();
    assert.equal(trip.active, false);
    assert.ok(trip.sessionId);
    assert.match(trip.state.message, /End trip/);
  } finally { trip.destroy(); }
});
test("trip publishes only fresh accurate GPS, throttles writes, and clears watch ID zero on stop", async () => {
  const { trip, calls, fix } = setup();
  try {
    await trip.start("adankolo-felele");
    assert.equal(trip.state.phase, "locating");
    await fix({ accuracy: 200 });
    assert.equal(calls.filter((c) => c[0] === "write").length, 0);
    await fix();
    assert.equal(trip.state.phase, "sharing");
    await fix();
    assert.equal(calls.filter((c) => c[0] === "write").length, 1);
    await trip.stop();
    assert.equal(trip.state.phase, "ended");
    assert.equal(trip.sessionId, null);
    assert.ok(calls.some((c) => c[0] === "clear" && c[1] === 0));
    await fix();
    assert.equal(calls.filter((c) => c[0] === "write").length, 1);
  } finally {
    trip.destroy();
  }
});
test("permission denied stops GPS and confirms offline without success UI", async () => {
  const { trip, error, calls } = setup();
  try {
    await trip.start();
    error(1);
    await flush();
    assert.equal(trip.active, false);
    assert.equal(trip.sessionId, null);
    assert.equal(trip.state.phase, "denied");
    assert.ok(calls.some((c) => c[0] === "end"));
  } finally {
    trip.destroy();
  }
});
test("disconnect stops GPS immediately and reconnect ends instead of resuming old locations", async () => {
  const { trip, fix, calls } = setup();
  try {
    await trip.start();
    trip.connection(false);
    await fix();
    assert.equal(calls.filter((c) => c[0] === "write").length, 0);
    assert.equal(trip.state.phase, "paused");
    trip.connection(true);
    await flush();
    assert.equal(trip.state.phase, "ended");
    assert.equal(trip.active, false);
  } finally {
    trip.destroy();
  }
});
test("failed update stops sharing and does not claim a successful send", async () => {
  const { trip, fix } = setup({
    write: async () => {
      throw new Error("permission_denied");
    },
  });
  try {
    await trip.start();
    await fix();
    assert.equal(trip.active, false);
    assert.equal(trip.state.lastSuccess, null);
    assert.equal(trip.state.phase, "error");
  } finally {
    trip.destroy();
  }
});
test("ending while initial claim is pending never starts a GPS watcher", async () => {
  let resolveClaim;
  const { trip, calls } = setup({
    claim: () => new Promise((resolve) => (resolveClaim = resolve)),
  });
  const pending = trip.start();
  await trip.stop();
  resolveClaim();
  await pending;
  assert.equal(trip.watch, null);
  assert.equal(trip.active, false);
  assert.equal(trip.sessionId, null);
  assert.ok(calls.some((c) => c[0] === "end"));
  trip.destroy();
});
test("failed end keeps ownership for retry and does not report success", async () => {
  const { trip } = setup({
    end: async () => {
      throw new Error("Disconnected");
    },
  });
  try {
    await trip.start();
    await trip.stop();
    assert.equal(trip.state.phase, "error");
    assert.ok(trip.sessionId);
    assert.equal(trip.active, false);
  } finally {
    trip.destroy();
  }
});
