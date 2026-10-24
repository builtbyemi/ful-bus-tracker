import {
  firebaseConfig,
  emulatorConfig,
  isFirebaseConfigured,
} from "./config.js";

let clientPromise;
export function getFirebaseClient() {
  if (!isFirebaseConfigured()) return Promise.resolve(null);
  if (!clientPromise)
    clientPromise = connect().catch((error) => {
      clientPromise = null;
      throw error;
    });
  return clientPromise;
}
async function connect() {
  if (
    emulatorConfig &&
    (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) ||
      !firebaseConfig.projectId.startsWith("demo-"))
  ) {
    throw new Error("Emulators require localhost and a demo project.");
  }
  // Pinned browser modules preserve the original no-build deployment model.
  const [appModule, databaseModule, authModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js"),
    import("https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js"),
  ]);
  const app = appModule.getApps()[0] || appModule.initializeApp(firebaseConfig);
  const database = databaseModule.getDatabase(app);
  const auth = authModule.getAuth(app);
  if (emulatorConfig) {
    databaseModule.connectDatabaseEmulator(
      database,
      emulatorConfig.host,
      emulatorConfig.databasePort,
    );
    authModule.connectAuthEmulator(
      auth,
      "http://" + emulatorConfig.host + ":" + emulatorConfig.authPort,
      { disableWarnings: true },
    );
  }
  return { database, auth, db: databaseModule, authentication: authModule };
}

export async function subscribeFleet(callbacks) {
  const client = await getFirebaseClient();
  if (!client) {
    callbacks.onUnavailable();
    return () => {};
  }
  const { database, db } = client;
  const cleanups = [
    db.onValue(db.ref(database, ".info/connected"), (snapshot) =>
      callbacks.onConnection(snapshot.val() === true),
    ),
    db.onValue(db.ref(database, ".info/serverTimeOffset"), (snapshot) =>
      callbacks.onOffset(Number(snapshot.val()) || 0),
    ),
    db.onValue(
      db.ref(database, "buses"),
      (snapshot) => callbacks.onBuses(snapshot.val() || {}),
      callbacks.onError,
    ),
  ];
  return () => cleanups.forEach((unsubscribe) => unsubscribe());
}
