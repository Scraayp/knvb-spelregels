import { createServer } from "http";
import { readFile } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST = join(__dirname, "dist");
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript",
  ".mjs":  "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
};

async function serve(req, res) {
  const url = new URL(req.url, `http://localhost`);
  let pathname = url.pathname;

  // Strip trailing slash except root
  if (pathname !== "/" && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  // Try the exact path, then with .html, then fall back to index.html (SPA)
  const candidates = [
    join(DIST, pathname),
    join(DIST, pathname + ".html"),
    join(DIST, "index.html"),
  ];

  for (const filePath of candidates) {
    try {
      const data = await readFile(filePath);
      const ext = extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
      return;
    } catch {
      // try next candidate
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
}

createServer(serve).listen(PORT, () => {
  console.log(`KNVB Spelregels Trainer listening on port ${PORT}`);
});
