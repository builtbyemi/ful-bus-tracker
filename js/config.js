// Public Firebase web identifiers, copied from Firebase Console after verification.
// Blank values intentionally disable all Firebase network activity.
// Never put passwords, service-account keys, or authorization secrets here.
export const firebaseConfig = Object.freeze({
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "ful-bus-tracker",
  appId: "",
});

export const emulatorConfig = null; // Local tests may supply { host:'127.0.0.1', authPort:9099, databasePort:9000 }.

export function isFirebaseConfigured() {
  return ["apiKey", "authDomain", "databaseURL", "projectId", "appId"].every(
    (key) =>
      typeof firebaseConfig[key] === "string" &&
      firebaseConfig[key].trim().length > 0,
  );
}
