// Pure tracking rules shared by the map, driver portal, and tests.
export const BUS_IDS = Object.freeze(["FUL-001", "FUL-002", "FUL-003"]);
export const GPS_FRESH_MS = 30_000;
export const HEARTBEAT_FRESH_MS = 25_000;
export const WRITE_INTERVAL_MS = 5_000;
export const HEARTBEAT_INTERVAL_MS = 10_000;
export const MAX_ACCURACY_METERS = 100;
export const FUTURE_TOLERANCE_MS = 5_000;
const radians = (degrees) => (degrees * Math.PI) / 180;

export function validCoordinates(lat, lng) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}
export function timestamp(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    return null;
  return value < 100_000_000_000 ? value * 1000 : value;
}
export function fresh(value, now, maxAge) {
  const time = timestamp(value);
  return (
    time !== null && now - time >= -FUTURE_TOLERANCE_MS && now - time <= maxAge
  );
}
export function busState(bus, now = Date.now(), connected = true) {
  if (!connected)
    return { key: "disconnected", label: "Connection lost", live: false };
  if (
    !bus ||
    bus.tripStarted !== true ||
    !["ONLINE", "STARTING"].includes(bus.status)
  )
    return { key: "offline", label: "Offline", live: false };
  if (!fresh(bus.lastHeartbeat, now, HEARTBEAT_FRESH_MS))
    return { key: "offline", label: "Offline", live: false };
  if (bus.status === "STARTING")
    return { key: "waiting", label: "Waiting for GPS", live: false };
  if (
    !validCoordinates(bus.latitude, bus.longitude) ||
    !timestamp(bus.lastGpsUpdate)
  )
    return { key: "waiting", label: "Waiting for GPS", live: false };
  if (!fresh(bus.lastGpsUpdate, now, GPS_FRESH_MS))
    return { key: "stale", label: "GPS stale", live: false };
  if (
    typeof bus.accuracy !== "number" ||
    !Number.isFinite(bus.accuracy) ||
    bus.accuracy < 0 ||
    bus.accuracy > MAX_ACCURACY_METERS
  )
    return { key: "weak", label: "Weak GPS", live: false };
  return { key: "live", label: "Live", live: true };
}
export function ageLabel(value, now = Date.now()) {
  const time = timestamp(value);
  if (time === null) return "Not received";
  const age = now - time;
  if (age < -FUTURE_TOLERANCE_MS) return "Invalid timestamp";
  if (age < 5000) return "Just now";
  if (age < 60_000) return Math.floor(age / 1000) + "s ago";
  if (age < 3_600_000) return Math.floor(age / 60_000) + "m ago";
  if (age < 86_400_000) return Math.floor(age / 3_600_000) + "h ago";
  return Math.floor(age / 86_400_000) + "d ago";
}
export function distanceMeters(a, b) {
  if (!a || !b || !validCoordinates(...a) || !validCoordinates(...b))
    return Infinity;
  const deltaLat = radians(b[0] - a[0]),
    deltaLng = radians(b[1] - a[1]);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(a[0])) *
      Math.cos(radians(b[0])) *
      Math.sin(deltaLng / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function bearing(a, b) {
  const l1 = radians(a[0]),
    l2 = radians(b[0]),
    delta = radians(b[1] - a[1]);
  return (
    ((Math.atan2(
      Math.sin(delta) * Math.cos(l2),
      Math.cos(l1) * Math.sin(l2) -
        Math.sin(l1) * Math.cos(l2) * Math.cos(delta),
    ) *
      180) /
      Math.PI +
      360) %
    360
  );
}
export function movement(previous, current, now = Date.now()) {
  const stationary = { moving: false, heading: null, animate: false };
  if (!busState(current, now).live) return stationary;
  const validSpeed =
    typeof current.speed === "number" &&
    Number.isFinite(current.speed) &&
    current.speed >= 1 &&
    current.speed <= 45;
  const deviceHeading =
    validSpeed &&
    typeof current.heading === "number" &&
    Number.isFinite(current.heading) &&
    current.heading >= 0 &&
    current.heading < 360
      ? current.heading
      : null;
  if (!previous || !busState(previous, now).live)
    return {
      moving: deviceHeading !== null,
      heading: deviceHeading,
      animate: false,
    };
  const dt =
    (timestamp(current.lastGpsUpdate) - timestamp(previous.lastGpsUpdate)) /
    1000;
  if (dt <= 0 || dt > GPS_FRESH_MS / 1000) return stationary;
  const a = [previous.latitude, previous.longitude],
    b = [current.latitude, current.longitude];
  const distance = distanceMeters(a, b);
  // Ignore GPS jitter, stationary fixes, and implausible jumps. No extrapolation.
  const jitter = Math.max(5, Math.max(previous.accuracy, current.accuracy));
  if (distance <= jitter || distance / dt > 45 || current.speed === 0)
    return stationary;
  return {
    moving: true,
    heading: deviceHeading ?? bearing(a, b),
    animate: distance <= 500,
  };
}
export function compass(heading) {
  if (heading === null || !Number.isFinite(heading)) return "Not determined";
  return [
    "North",
    "North-east",
    "East",
    "South-east",
    "South",
    "South-west",
    "West",
    "North-west",
  ][Math.round(heading / 45) % 8];
}
export function gpsFix(position, now = Date.now(), offset = 0) {
  const c = position?.coords;
  if (
    !c ||
    !validCoordinates(c.latitude, c.longitude) ||
    !fresh(position.timestamp, now, 10_000)
  )
    return null;
  if (
    typeof c.accuracy !== "number" ||
    !Number.isFinite(c.accuracy) ||
    c.accuracy < 0 ||
    c.accuracy > MAX_ACCURACY_METERS
  )
    return null;
  return {
    latitude: c.latitude,
    longitude: c.longitude,
    accuracy: c.accuracy,
    lastGpsUpdate: position.timestamp + offset,
    heading:
      typeof c.heading === "number" && c.heading >= 0 && c.heading < 360
        ? c.heading
        : null,
    speed:
      typeof c.speed === "number" && c.speed >= 0 && c.speed <= 45
        ? c.speed
        : null,
  };
}
