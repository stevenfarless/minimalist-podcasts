const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1:4173").pathname;
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const filename = path.resolve(root, requested);
  if (!filename.startsWith(root + path.sep) && filename !== path.join(root, "index.html")) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  fs.readFile(filename, (error, content) => {
    if (error) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": filename.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
    response.end(content);
  });
});
server.listen(4173, "127.0.0.1");
