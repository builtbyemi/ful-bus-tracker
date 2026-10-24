import { getFirebaseClient } from "./js/firebase-client.js";
import { BUS_IDS, ageLabel, GPS_FRESH_MS } from "./js/tracking.js";
import { createDriverBackend } from "./js/driver-backend.js";
import { TripController } from "./js/trip-controller.js";

const byId = (id) => document.getElementById(id);
let client,
  controller,
  backend,
  connected = false,
  offset = 0,
  busId = null,
  assignmentUnsubscribe = () => {},
  authUnsubscribe = () => {},
  epoch = 0;
const subscriptions = [];
let disposed = false;
let tripState = {
  phase: "idle",
  lastSuccess: null,
  accuracy: null,
  startedAt: null,
};
const controls = ["email", "password", "toggle-password", "login-button"];
const authMessages = {
  "auth/invalid-credential":
    "The email or password is incorrect. Please try again.",
  "auth/wrong-password":
    "The email or password is incorrect. Please try again.",
  "auth/user-not-found":
    "The email or password is incorrect. Please try again.",
  "auth/too-many-requests":
    "Too many sign-in attempts. Please wait a moment before trying again.",
  "auth/network-request-failed":
    "Sign-in could not connect. Check your internet connection and try again.",
  "auth/user-disabled":
    "This driver account is disabled. Contact your transport administrator.",
};
function message(id, text) {
  byId(id).textContent = text;
}
function render() {
  if (disposed) return;
  message("driver-connection", connected ? "Connected" : "Disconnected");
  const busy = controller?.starting || controller?.ending;
  const ownsTrip = Boolean(controller?.sessionId);
  byId("start-trip").hidden = ownsTrip;
  byId("start-trip").disabled =
    !busId || !connected || busy || !client || !window.isSecureContext;
  byId("end-trip").hidden = !ownsTrip;
  byId("end-trip").disabled = controller?.ending;
  byId("logout-button").disabled = ownsTrip || busy;
  byId("trip-route").disabled = ownsTrip || !busId;
  byId("recover-trip").hidden =
    ownsTrip || !backend || tripState.phase !== "error";
  message("last-success", ageLabel(tripState.lastSuccess));
  message(
    "driver-accuracy",
    typeof tripState.accuracy === "number" &&
      Number.isFinite(tripState.accuracy)
      ? "± " + Math.round(tripState.accuracy) + " m"
      : "Not available",
  );
  let duration = tripState.startedAt
    ? Math.max(
        0,
        Math.floor(
          ((ownsTrip ? Date.now() : (tripState.endedAt ?? Date.now())) -
            tripState.startedAt) /
            1000,
        ),
      )
    : 0;
  message(
    "trip-duration",
    Math.floor(duration / 60)
      .toString()
      .padStart(2, "0") +
      ":" +
      (duration % 60).toString().padStart(2, "0"),
  );
  const fresh =
    tripState.lastGpsUpdate &&
    Date.now() + offset - tripState.lastGpsUpdate <= GPS_FRESH_MS;
  const live =
    controller?.active && connected && fresh && tripState.phase === "sharing";
  const status = byId("driver-status");
  status.textContent = live
    ? "Sharing"
    : controller?.active
      ? fresh
        ? "Waiting"
        : "GPS stale"
      : ownsTrip
        ? "Paused"
        : "Offline";
  status.className = "pill" + (live ? " live" : ownsTrip ? " warning" : "");
  if (controller?.active && !fresh && tripState.phase === "sharing")
    message(
      "trip-message",
      "GPS updates have stopped. Students see the last known location as stale. Keep this page open and check location access.",
    );
}
function onTripState(state) {
  tripState = { ...state };
  if (["ended", "denied"].includes(state.phase)) tripState.endedAt = Date.now();
  message("trip-message", state.message);
  byId("trip-message").classList.toggle(
    "error",
    ["error", "denied"].includes(state.phase),
  );
  render();
}
async function assignmentChanged(snapshot, authEpoch) {
  if (authEpoch !== epoch) return;
  const next = snapshot.val();
  if (next === busId && controller) return;
  controller?.destroy();
  controller = null;
  backend = null;
  busId = BUS_IDS.includes(next) ? next : null;
  message("assigned-bus", busId || "No bus assigned");
  byId("assignment-message").hidden = Boolean(busId);
  if (!busId)
    message(
      "assignment-message",
      "Your account is not assigned to a bus. Contact your transport administrator.",
    );
  else {
    backend = createDriverBackend(client, busId);
    controller = new TripController({
      backend,
      geolocation: navigator.geolocation,
      onChange: onTripState,
      offset: () => offset,
    });
    controller.connection(connected);
    tripState = { ...controller.state };
    message("trip-message", tripState.message);
  }
  render();
}
async function initialize() {
  try {
    client = await getFirebaseClient();
    if (disposed) {
      if (client) client.db.goOffline(client.database);
      return;
    }
    if (!client) {
      message(
        "configuration-message",
        "Driver sign-in is not available yet. Contact your transport administrator for service availability.",
      );
      return;
    }
    const { db, database, auth, authentication } = client;
    await authentication.setPersistence(
      auth,
      authentication.inMemoryPersistence,
    );
    if (disposed) return;
    byId("configuration-message").hidden = true;
    controls.forEach((id) => (byId(id).disabled = false));
    subscriptions.push(
      db.onValue(db.ref(database, ".info/connected"), (snapshot) => {
        connected = snapshot.val() === true;
        controller?.connection(connected);
        render();
      }),
      db.onValue(db.ref(database, ".info/serverTimeOffset"), (snapshot) => {
        offset = Number(snapshot.val()) || 0;
      }),
    );
    authUnsubscribe = authentication.onAuthStateChanged(auth, (user) => {
      const authEpoch = ++epoch;
      assignmentUnsubscribe();
      controller?.destroy();
      controller = null;
      busId = null;
      backend = null;
      byId("login-section").hidden = Boolean(user);
      byId("dashboard-section").hidden = !user;
      if (user) {
        message("assigned-bus", "Checking assignment…");
        assignmentUnsubscribe = db.onValue(
          db.ref(database, "drivers/" + user.uid + "/busId"),
          (snapshot) => assignmentChanged(snapshot, authEpoch),
          () => {
            busId = null;
            controller?.destroy();
            controller = null;
            message("assigned-bus", "Assignment unavailable");
            byId("assignment-message").hidden = false;
            message(
              "assignment-message",
              "Your bus assignment could not be verified. Contact your transport administrator.",
            );
            render();
          },
        );
      }
      render();
    });
  } catch {
    message(
      "configuration-message",
      "Driver sign-in could not connect. Check your connection and reload this page.",
    );
    byId("configuration-message").classList.add("error");
  }
}
byId("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client) return;
  byId("login-button").disabled = true;
  message("login-button", "Signing in…");
  message("login-message", "");
  try {
    await client.authentication.signInWithEmailAndPassword(
      client.auth,
      byId("email").value.trim(),
      byId("password").value,
    );
    byId("password").value = "";
  } catch (error) {
    message(
      "login-message",
      authMessages[error.code] ||
        "Sign-in is unavailable. Contact your transport administrator.",
    );
  } finally {
    byId("login-button").disabled = false;
    message("login-button", "Sign in");
  }
});
byId("toggle-password").addEventListener("click", () => {
  const show = byId("password").type === "password";
  byId("password").type = show ? "text" : "password";
  message("toggle-password", show ? "Hide" : "Show");
  byId("toggle-password").setAttribute(
    "aria-label",
    show ? "Hide password" : "Show password",
  );
  byId("toggle-password").setAttribute("aria-pressed", String(show));
});
byId("start-trip").addEventListener("click", async () => {
  if (!controller) return;
  try {
    await controller.start(byId("trip-route").value);
  } catch (error) {
    message("trip-message", error.message);
  }
  render();
});
byId("end-trip").addEventListener("click", () =>
  byId("end-dialog").showModal(),
);
byId("end-dialog").addEventListener("close", async () => {
  if (byId("end-dialog").returnValue === "end") {
    await controller?.stop();
    render();
  }
  byId(controller?.sessionId ? "end-trip" : "start-trip").focus();
});
byId("recover-trip").addEventListener("click", async () => {
  byId("recover-trip").disabled = true;
  try {
    await backend.recover(Date.now() + offset);
    message(
      "trip-message",
      "Disconnected trip recovered. You can now start a new trip.",
    );
  } catch (error) {
    message("trip-message", error.message);
  } finally {
    byId("recover-trip").disabled = false;
  }
});
byId("logout-button").addEventListener("click", async () => {
  if (controller?.sessionId) return;
  try {
    await client.authentication.signOut(client.auth);
  } catch {
    message("trip-message", "Sign-out could not finish. Please try again.");
  }
});
if (!window.isSecureContext)
  message(
    "trip-message",
    "Location sharing requires a secure connection. Open the site using HTTPS.",
  );
let permissionStatus;
navigator.permissions
  ?.query({ name: "geolocation" })
  .then((status) => {
    permissionStatus = status;
    const update = () =>
      message(
        "gps-permission",
        status.state === "granted"
          ? "Allowed"
          : status.state === "denied"
            ? "Blocked"
            : "Not requested",
      );
    status.onchange = update;
    update();
  })
  .catch(() => {});
const timer = setInterval(render, 1000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && controller?.active)
    message(
      "trip-message",
      "This page is in the background. GPS updates may pause; return to the page to keep sharing.",
    );
  else render();
});
window.addEventListener("pagehide", () => {
  disposed = true;
  epoch++;
  controller?.destroy();
  clearInterval(timer);
  authUnsubscribe();
  assignmentUnsubscribe();
  subscriptions.forEach((stop) => stop());
  if (permissionStatus) permissionStatus.onchange = null;
  // Server-registered disconnect cleanup is authoritative; unload fetches are unreliable.
  if (client) client.db.goOffline(client.database);
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
initialize();
