import { BUS_IDS, busState, ageLabel, compass } from "./js/tracking.js";
import {
  CAMPUSES,
  ROUTE_ID,
  ROUTE_NAME,
  VERIFIED_ROUTE,
  validateGeometry,
  loadReferenceRoute,
} from "./js/routes.js";
import { BusMarkers } from "./js/markers.js";
import { subscribeFleet } from "./js/firebase-client.js";
import { isPermissionDenied } from "./js/errors.js";

const byId = (id) => document.getElementById(id);
let map, markers, routeLine, routeOutline, routeRequest, resizeObserver;
let fleet = {},
  selected = BUS_IDS[0],
  connected = false,
  received = false,
  unavailable = false,
  failed = false,
  accessDenied = false,
  offset = 0,
  disposed = false;
let unsubscribe = () => {};
const bounds = CAMPUSES.map((campus) => campus.coordinates);
const now = () => Date.now() + offset;
const setText = (id, value) => {
  if (byId(id).textContent !== value) byId(id).textContent = value;
};

function initializeMap() {
  if (!window.L) {
    byId("map-failure").hidden = false;
    return;
  }
  map = L.map("map", { zoomControl: false, minZoom: 8, maxZoom: 18 }).fitBounds(
    bounds,
    { padding: [55, 110] },
  );
  L.control.zoom({ position: "topright" }).addTo(map);
  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
  const tiles = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  ).addTo(map);
  let tileErrors = 0;
  tiles.on("tileerror", () => {
    if (++tileErrors >= 3) {
      byId("map-failure").textContent =
        "Map tiles are unavailable. Campus markers and bus details remain available; check your connection.";
      byId("map-failure").hidden = false;
    }
  });
  tiles.on("tileload", () => {
    tileErrors = 0;
    byId("map-failure").hidden = true;
  });
  for (const campus of CAMPUSES) {
    const popup = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = campus.name;
    const description = document.createElement("p");
    description.textContent = campus.description;
    const note = document.createElement("small");
    note.textContent = "Campus location · Bus stop not yet confirmed";
    popup.append(title, description, note);
    L.marker(campus.coordinates, {
      icon: L.divIcon({
        className: "campus-marker",
        iconSize: [17, 17],
        iconAnchor: [8, 8],
      }),
      title: campus.name,
      alt: campus.name,
    })
      .addTo(map)
      .bindTooltip(campus.name, {
        permanent: true,
        direction: "right",
        offset: [12, 0],
        className: "campus-label",
      })
      .bindPopup(popup);
  }
  markers = new BusMarkers(map, selectBus);
  resizeObserver = new ResizeObserver(() =>
    map?.invalidateSize({ pan: false }),
  );
  resizeObserver.observe(byId("map"));
}
function badge(element, state) {
  element.textContent = state.label;
  element.className =
    "pill" +
    (state.live
      ? " live"
      : ["stale", "waiting", "weak"].includes(state.key)
        ? " warning"
        : "");
}
function currentState(bus) {
  if (unavailable || failed || !received)
    return { key: "unavailable", label: "Unavailable", live: false };
  return busState(bus, now(), connected && navigator.onLine);
}
function render() {
  if (disposed) return;
  let count = 0;
  for (const id of BUS_IDS) {
    const bus = fleet[id],
      state = currentState(bus);
    if (state.live) count++;
    badge(byId("status-" + id), state);
    setText(
      "route-" + id,
      bus?.routeId === ROUTE_ID ? ROUTE_NAME : "Route not reported",
    );
    markers?.update(
      id,
      bus,
      now(),
      connected && !failed && !unavailable,
      selected,
    );
  }
  setText("live-count", count + " live");
  byId("live-count").classList.toggle("live", count > 0);
  setText("mobile-count", "· " + count + " live");
  const status = byId("connection-status");
  const message = byId("map-notice");
  if (unavailable) {
    status.textContent = "Tracking unavailable";
    message.textContent =
      "Live tracking is not connected yet. Campus locations are available; current bus availability cannot be confirmed.";
  } else if (failed) {
    status.textContent = "Updates unavailable";
    message.textContent = accessDenied
      ? "Bus updates are unavailable because database access was denied. Please notify the transport administrator. Reload after access is restored."
      : "Bus updates could not be loaded. Check your connection or try reloading. Last known positions are not live.";
  } else if (!connected || !navigator.onLine) {
    status.textContent = received ? "Connection lost" : "Connecting";
    message.textContent = received
      ? "Connection lost. Locations are last known; live tracking will resume after fresh updates arrive."
      : "Connecting to bus updates…";
  } else if (!received) {
    status.textContent = "Loading buses";
    message.textContent = "Connected. Waiting for the first bus update…";
  } else {
    status.textContent = "Connected";
    message.textContent = count
      ? count +
        " " +
        (count === 1 ? "bus is" : "buses are") +
        " sharing fresh GPS. Select a bus for details."
      : "No buses are sharing fresh GPS right now. Check back when a driver starts a trip.";
  }
  status.classList.toggle(
    "live",
    connected && received && !failed && !unavailable,
  );
  const empty = byId("empty-state");
  empty.hidden = count > 0;
  empty.querySelector("strong").textContent =
    unavailable || failed
      ? "Live updates unavailable"
      : !connected
        ? "Waiting for connection"
        : !received
          ? "Waiting for bus updates"
          : "No live buses right now";
  empty.querySelector("p").textContent = unavailable
    ? "Bus availability cannot be confirmed until tracking is connected."
    : "Fresh bus locations appear automatically. Stale locations are marked as last known.";
  const bus = fleet[selected],
    state = currentState(bus);
  setText("selected-bus", selected);
  badge(byId("selected-status"), state);
  setText(
    "selected-route",
    bus?.routeId === ROUTE_ID ? ROUTE_NAME : "Not reported",
  );
  const direction = state.live
    ? bus.speed === 0
      ? "Stationary"
      : compass(markers?.heading(selected) ?? null)
    : "Not determined";
  setText("selected-direction", direction);
  setText("selected-gps", ageLabel(bus?.lastGpsUpdate, now()));
  setText(
    "selected-accuracy",
    typeof bus?.accuracy === "number" &&
      Number.isFinite(bus.accuracy) &&
      bus.accuracy >= 0
      ? "± " + Math.round(bus.accuracy) + " m"
      : "Not available",
  );
  byId("focus-bus").disabled = !state.live || !map;
  if (routeLine)
    routeLine.setStyle({
      color: bus?.routeId === ROUTE_ID ? "#286b7b" : "#49618D",
      weight: bus?.routeId === ROUTE_ID ? 5 : 4,
    });
}
function selectBus(id) {
  if (!BUS_IDS.includes(id)) return;
  selected = id;
  document.querySelectorAll("[data-bus]").forEach((button) => {
    const active = button.dataset.bus === id;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  render();
  if (currentState(fleet[id]).live) markers?.focus(id);
}
initializeMap();
document
  .querySelectorAll("[data-bus]")
  .forEach((button) =>
    button.addEventListener("click", () => selectBus(button.dataset.bus)),
  );
byId("fit-map").addEventListener("click", () =>
  map?.fitBounds(bounds, {
    padding: [55, 110],
    animate: !matchMedia("(prefers-reduced-motion: reduce)").matches,
  }),
);
byId("focus-bus").addEventListener("click", () => markers?.focus(selected));
byId("sheet-toggle").addEventListener("click", () => {
  const expanded = byId("bus-panel").classList.toggle("expanded");
  byId("sheet-toggle").setAttribute("aria-expanded", String(expanded));
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    byId("bus-panel").classList.contains("expanded")
  ) {
    byId("bus-panel").classList.remove("expanded");
    byId("sheet-toggle").setAttribute("aria-expanded", "false");
    byId("sheet-toggle").focus();
  }
});
byId("show-route").addEventListener("change", async (event) => {
  routeRequest?.abort();
  if (routeLine) {
    routeLine.remove();
    routeLine = null;
    routeOutline.remove();
    routeOutline = null;
  }
  if (!event.target.checked) {
    setText("route-message", "Road reference hidden.");
    return;
  }
  if (!map) {
    event.target.checked = false;
    setText("route-message", "Load the map before showing a road reference.");
    return;
  }
  routeRequest = new AbortController();
  const request = routeRequest;
  const timeout = setTimeout(() => request.abort(), 10_000);
  setText("route-message", "Loading road reference…");
  try {
    const geometry = VERIFIED_ROUTE
      ? validateGeometry(VERIFIED_ROUTE)
      : await loadReferenceRoute(request.signal);
    if (!geometry) throw new Error("Invalid route geometry");
    if (request.signal.aborted || !byId("show-route").checked) return;
    routeOutline = L.polyline(geometry, {
      color: "#fff",
      weight: 9,
      opacity: 0.85,
    }).addTo(map);
    routeLine = L.polyline(geometry, {
      color: "#49618D",
      weight: 4,
      dashArray: VERIFIED_ROUTE ? null : "8 8",
      opacity: 0.85,
    }).addTo(map);
    routeLine.bindTooltip(
      VERIFIED_ROUTE
        ? "University-verified route"
        : "Driving reference · Not an official bus route",
    );
    setText(
      "route-message",
      VERIFIED_ROUTE
        ? "University-verified route."
        : "OSRM driving reference only. Not verified as a university bus route; no timetable or arrival estimate.",
    );
    render();
  } catch {
    if (request === routeRequest && byId("show-route").checked) {
      setText(
        "route-message",
        "Road reference unavailable. Campus locations remain visible. Toggle to retry.",
      );
      byId("show-route").checked = false;
    }
  } finally {
    clearTimeout(timeout);
  }
});
render();
const ticker = setInterval(render, 1000);
const connectionTimeout = setTimeout(() => {
  if (!received && !unavailable && !failed) {
    failed = true;
    render();
  }
}, 15_000);
subscribeFleet({
  onUnavailable() {
    unavailable = true;
    render();
  },
  onConnection(value) {
    connected = value;
    render();
  },
  onOffset(value) {
    offset = value;
    render();
  },
  onBuses(value) {
    fleet = value;
    received = true;
    failed = false;
    accessDenied = false;
    render();
  },
  onError(error) {
    accessDenied = isPermissionDenied(error);
    failed = true;
    connected = false;
    render();
  },
})
  .then((stop) => {
    if (disposed) stop();
    else unsubscribe = stop;
  })
  .catch(() => {
    failed = true;
    render();
  });
window.addEventListener("offline", () => {
  connected = false;
  render();
});
document.addEventListener("visibilitychange", render);
window.addEventListener("pagehide", () => {
  disposed = true;
  clearInterval(ticker);
  clearTimeout(connectionTimeout);
  unsubscribe();
  routeRequest?.abort();
  resizeObserver?.disconnect();
  markers?.destroy();
  map?.remove();
  map = null;
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
