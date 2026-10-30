#!/usr/bin/env node
/**
 * Local Development Server with Automatic Resume PDF Watcher
 * Serves 4ofl.dev on port 8088 with proper MIME types & 302 redirects.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { compile, DATA_FILE } = require("./build-resume");

const PORT = 8088;
const ROOT = path.resolve(__dirname, "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

// Compile resume on dev server boot
compile();

// Start file watcher for resume data
let debounceTimer = null;
if (fs.existsSync(DATA_FILE)) {
  fs.watch(DATA_FILE, () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(`[watch] ${path.relative(ROOT, DATA_FILE)} changed. Auto-recompiling PDF...`);
      compile();
    }, 250);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let pathname = decodeURIComponent(url.pathname);

  // Resume redirects
  if (pathname === "/resume" || pathname === "/resume/" || pathname === "/cv" || pathname === "/cv/") {
    res.writeHead(302, { Location: "/resume.pdf" });
    res.end();
    return;
  }

  // Resolve file path
  let filePath = path.join(ROOT, pathname);

  // If path is a directory, serve index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  // Try appending index.html if file doesn't exist
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + "/index.html")) {
    filePath = filePath + "/index.html";
  }

  // Try appending .html
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + ".html")) {
    filePath = filePath + ".html";
  }

  // If not found, serve 404
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const notFoundPath = path.join(ROOT, "404.html");
    if (fs.existsSync(notFoundPath)) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(notFoundPath));
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
    }
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  4ofl.dev Local Dev Server Active`);
  console.log(`  Local URL:   http://localhost:${PORT}/`);
  console.log(`  Resume PDF:  http://localhost:${PORT}/resume.pdf`);
  console.log(`  Watching:    resume/resume-data.json (auto-builds PDF)`);
  console.log(`========================================\n`);
});
