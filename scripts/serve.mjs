import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpeg": "image/jpeg",
  ".jfif": "image/jpeg",
  ".woff2": "font/woff2",
};
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const target = path.resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (
      !target.startsWith(root + path.sep) ||
      pathname.split("/").some((p) => p.startsWith("."))
    ) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    const body = await readFile(target);
    res.writeHead(200, {
      "Content-Type":
        (types[path.extname(target)] || "application/octet-stream") +
        "; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
});
server.listen(4173, "127.0.0.1", () =>
  console.log("Local preview: http://127.0.0.1:4173"),
);
