// Public Firebase web identifiers, copied from Firebase Console after verification.
// Blank values intentionally disable all Firebase network activity.
// Never put passwords, service-account keys, or authorization secrets here.
export const firebaseConfig = {
  apiKey: "AIzaSyB2c9vYF7vdRglr7KJKnbcmMb8ce06al4c",
  authDomain: "ful-bus-tracker.firebaseapp.com",
  databaseURL: "https://ful-bus-tracker-default-rtdb.firebaseio.com",
  projectId: "ful-bus-tracker",
  storageBucket: "ful-bus-tracker.firebasestorage.app",
  messagingSenderId: "770210508038",
  appId: "1:770210508038:web:1a38889aeb4d7f56018287",
  measurementId: "G-KCQQPXEVSP"
};

export const emulatorConfig = null; // Local tests may supply { host:'127.0.0.1', authPort:9099, databasePort:9000 }.

export function isFirebaseConfigured() {
  return ["apiKey", "authDomain", "databaseURL", "projectId", "appId"].every(
    (key) =>
      typeof firebaseConfig[key] === "string" &&
      firebaseConfig[key].trim().length > 0,
  );
}
