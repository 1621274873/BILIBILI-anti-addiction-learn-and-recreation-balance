import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { projectRoot } from "./lib/project.mjs";

const root = resolve(projectRoot);
const port = Number(process.env.PREVIEW_PORT || 8765);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

const server = createServer(async (request, response) => {
  const pathname = new URL(
    request.url || "/",
    `http://127.0.0.1:${port}`
  ).pathname;
  const relativePath =
    pathname === "/" ? "/docs/preview.html" : pathname;
  const filePath = resolve(root, `.${relativePath}`);

  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  // Serve only UI preview resources; never expose repository internals.
  if (!/^\/(?:docs|src)\//.test(relativePath) || ![".css", ".html", ".js"].includes(extname(filePath))) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type":
        contentTypes[extname(filePath)] || "application/octet-stream"
    });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Preview: http://127.0.0.1:${port}/`);
  console.log(`Popup:   http://127.0.0.1:${port}/docs/popup-preview.html`);
});
