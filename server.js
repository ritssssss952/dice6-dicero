const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Health check
  if (url.pathname === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json"
    });

    return res.end(
      JSON.stringify({
        ok: true,
        game: "DICE 6"
      })
    );
  }

  // Main page
  let requestPath = decodeURIComponent(url.pathname);

  if (requestPath === "/") {
    requestPath = "/index.html";
  }

  const filePath = path.resolve(ROOT, "." + requestPath);

  // Security check
  if (
    filePath !== ROOT &&
    !filePath.startsWith(ROOT + path.sep)
  ) {
    res.writeHead(403, {
      "Content-Type": "text/plain"
    });

    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.log("FILE NOT FOUND:", filePath);

      res.writeHead(404, {
        "Content-Type": "text/plain"
      });

      return res.end("Not Found");
    }

    const ext = path.extname(filePath).toLowerCase();

    res.writeHead(200, {
      "Content-Type":
        mimeTypes[ext] || "application/octet-stream",
      "Cache-Control":
        ext === ".html"
          ? "no-store"
          : "public, max-age=3600"
    });

    res.end(data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`DICE 6 running on port ${PORT}`);
});
