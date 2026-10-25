export function isPermissionDenied(error) {
  return /permission[_ -]?denied/i.test(
    String(error?.code || "") + " " + String(error?.message || ""),
  );
}
export function tripErrorMessage(error, fallback) {
  return isPermissionDenied(error)
    ? "Access to this bus was denied. Ask your transport administrator to check the database rules and your bus assignment, then sign in again."
    : fallback;
}
