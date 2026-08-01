import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const port = Number.parseInt(process.argv[2] || "4320", 10);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "reference-app");
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'";
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"]
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${host}:${port}`);
    const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(root, relative);
    const inside = path.relative(root, file);
    if (!inside || inside.startsWith("..") || path.isAbsolute(inside)) throw new Error("not found");
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": contentTypes.get(path.extname(file)) || "application/octet-stream",
      "Content-Security-Policy": csp,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store"
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Content-Security-Policy": csp });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  process.stdout.write(`public-app-shell/v2 strict-CSP reference: http://${host}:${port}/\n`);
});
