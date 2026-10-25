import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

// Always a local demo project, irrespective of the real app's Firebase config.
const env = { ...process.env };
const javaRoot = path.resolve(".local-tools/java");
if (existsSync(javaRoot)) {
  const java = readdirSync(javaRoot)
    .map((name) => path.join(javaRoot, name, "bin"))
    .find((dir) =>
      existsSync(
        path.join(dir, process.platform === "win32" ? "java.exe" : "java"),
      ),
    );
  if (java)
    env[
      Object.keys(env).find((key) => key.toLowerCase() === "path") || "PATH"
    ] = java + path.delimiter + (env.Path || env.PATH || "");
}
if (existsSync(".local-tools/emulators/firebase-database-emulator-v4.11.2.jar"))
  env.FIREBASE_EMULATORS_PATH = path.resolve(".local-tools/emulators");
const child = spawn(
  process.execPath,
  [
    "node_modules/firebase-tools/lib/bin/firebase.js",
    "emulators:exec",
    "--project",
    "demo-ful-bus-tracker",
    "--config",
    "firebase.emulators.json",
    "--only",
    "database,auth",
    "node --test --test-concurrency=1 tests/rules.test.mjs tests/firebase-integration.test.mjs",
  ],
  { stdio: "inherit", env },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
