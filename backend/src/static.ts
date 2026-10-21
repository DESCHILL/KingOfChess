import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

const root = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));
const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const routes = new Set(["/", "/account", "/rooms", "/game", "/history", "/computer"]);

export async function serveFrontend(req: IncomingMessage, res: ServerResponse, path: string) {
    if (path === "/api" || path.startsWith("/api/") || path === "/ws") return false;
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { Allow: "GET, HEAD" }); res.end(); return true; }
    let decoded: string;
    try { decoded = decodeURIComponent(path); } catch { res.writeHead(400); res.end(); return true; }
    const file = routes.has(decoded) ? resolve(root, "index.html") : resolve(root, `.${decoded}`);
    if (!file.startsWith(resolve(root) + sep) || decoded.includes("\\") || decoded.includes("\0") || decoded.split("/").some(part => part.startsWith("."))) {
        res.writeHead(404); res.end(); return true;
    }
    try {
        const data = await readFile(file);
        res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Content-Length": data.length, "Cache-Control": path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache" });
        res.end(req.method === "HEAD" ? undefined : data);
    } catch {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Không tìm thấy trang. Hãy chạy npm run build trước khi npm start.");
    }
    return true;
}
