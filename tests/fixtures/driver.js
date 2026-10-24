// UI TEST DOUBLE ONLY. Not a Firebase authorization test; see rules.test.mjs.
const state = (window.testDriver = {
  records: {},
  connected: true,
  failWrites: false,
  assignment: "FUL-001",
  disconnect: null,
});
let authCallback;
export async function getFirebaseClient() {
  return {
    database: {},
    auth: {},
    authentication: {
      inMemoryPersistence: {},
      setPersistence: async () => {},
      onAuthStateChanged(auth, callback) {
        authCallback = callback;
        callback(null);
        return () => {};
      },
      async signInWithEmailAndPassword(auth, email, password) {
        if (
          email !== "driver@example.test" ||
          password !== "test-only-password"
        )
          throw { code: "auth/invalid-credential" };
        authCallback({ uid: "test-driver" });
      },
      async signOut() {
        authCallback(null);
      },
    },
    db: {
      ref(db, path) {
        return path;
      },
      onValue(path, callback) {
        if (path === ".info/connected") {
          state.connectionCallback = callback;
          callback({ val: () => state.connected });
        } else if (path === ".info/serverTimeOffset")
          callback({ val: () => 0 });
        else callback({ val: () => state.assignment });
        return () => {};
      },
      serverTimestamp() {
        return Date.now();
      },
      async runTransaction(path, update) {
        const value = update(state.records[path] || null);
        if (value === undefined) return { committed: false };
        state.records[path] = value;
        return { committed: true };
      },
      onDisconnect() {
        return {
          async update(value) {
            state.disconnect = value;
          },
          async cancel() {
            state.disconnect = null;
          },
        };
      },
      async update(path, patch) {
        if (state.failWrites) throw new Error("permission_denied");
        state.records[path] = { ...state.records[path], ...patch };
      },
      goOffline() {
        state.connected = false;
      },
    },
  };
}
