import { validCoordinates, distanceMeters } from "./tracking.js";

// Preserved from the original tracker. These are campus locations, not verified stops.
export const CAMPUSES = Object.freeze([
  {
    id: "adankolo",
    name: "Adankolo",
    description: "College of Health Sciences",
    coordinates: [7.7925993, 6.7323953],
  },
  {
    id: "felele",
    name: "Felele Campus",
    description: "Federal University Lokoja",
    coordinates: [7.8639932, 6.6828039],
  },
]);
export const ROUTE_CHECKPOINT = [7.8199372, 6.6957385];
export const ROUTE_ID = "adankolo-felele";
export const ROUTE_NAME = "Adankolo ↔ Felele";
// Set only after university review, with reviewed GeoJSON [longitude, latitude] coordinates.
export const VERIFIED_ROUTE = null;

export function validateGeometry(coordinates) {
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    coordinates.length > 20_000
  )
    return null;
  if (
    coordinates.some(
      (p) =>
        !Array.isArray(p) ||
        p.length !== 2 ||
        !validCoordinates(p[1], p[0]) ||
        p[1] < 7.7 ||
        p[1] > 7.95 ||
        p[0] < 6.55 ||
        p[0] > 6.85,
    )
  )
    return null;
  const points = coordinates.map(([lng, lat]) => [lat, lng]);
  if (
    distanceMeters(points[0], CAMPUSES[0].coordinates) > 500 ||
    distanceMeters(points.at(-1), CAMPUSES[1].coordinates) > 500
  )
    return null;
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const segment = distanceMeters(points[i - 1], points[i]);
    if (segment > 2000) return null;
    length += segment;
  }
  return length >= 8000 && length <= 40_000 ? points : null;
}

export async function loadReferenceRoute(signal) {
  const waypoints = [
    CAMPUSES[0].coordinates,
    ROUTE_CHECKPOINT,
    CAMPUSES[1].coordinates,
  ]
    .map(([lat, lng]) => lng + "," + lat)
    .join(";");
  const response = await fetch(
    "https://router.project-osrm.org/route/v1/driving/" +
      waypoints +
      "?overview=full&geometries=geojson",
    { signal },
  );
  if (!response.ok) throw new Error("Road reference unavailable");
  const data = await response.json();
  const route = data.code === "Ok" ? data.routes?.[0] : null;
  const geometry =
    route?.geometry?.type === "LineString"
      ? validateGeometry(route.geometry.coordinates)
      : null;
  if (!geometry) throw new Error("Road geometry did not pass validation");
  return geometry;
}
