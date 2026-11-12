const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1:4173").pathname;
  if (pathname === "/__test__/redirect-feed.xml") {
    response.writeHead(302, { Location: "/__test__/published/feed.xml" }).end();
    return;
  }
  if (pathname === "/__test__/published/feed.xml") {
    const feed = `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Redirect Podcast</title>
      <entry><id>tag:example.test,2026:redirect-one</id><title>Redirect Episode</title>
        <link rel="enclosure" type="audio/mpeg" href="../media/redirect.mp3"/>
      </entry>
    </feed>`;
    response.writeHead(200, { "Content-Type": "application/atom+xml; charset=utf-8" }).end(feed);
    return;
  }
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
