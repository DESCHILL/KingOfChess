import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer } from "ws";
import { initializeDatabase, query } from "./database.js";
import { authenticate, register, login, createSession, logout, sessionScope, type User } from "./auth.js";
import { gameManager } from "./GameManager.js";
import { config } from "./config.js";
import { serveFrontend } from "./static.js";

const { port, host, origins: allowedOrigins } = config;
const attempts = new Map<string, { count: number; until: number }>();
const respond = (res: ServerResponse, status: number, data: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(data));
};
async function body(req: IncomingMessage) {
    let text = "";
    for await (const part of req) { text += part; if (Buffer.byteLength(text) > 4096) throw new Error("Dữ liệu quá dài"); }
    const value: unknown = JSON.parse(text || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Dữ liệu không hợp lệ");
    return value as Record<string, unknown>;
}
await initializeDatabase();
await gameManager.initialize();
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
const users = new WeakMap<object, User>();
const scopes = new WeakMap<object, string>();
const server = createServer((req, res) => {
    void (async () => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("Referrer-Policy", "same-origin");
        res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
        const path = new URL(req.url || "/", "http://localhost").pathname;
        if (req.headers.origin && !allowedOrigins.has(req.headers.origin)) { respond(res, 403, { error: "Nguồn truy cập không được phép" }); return; }
        if (await serveFrontend(req, res, path)) return;
        if (path === "/api/health") { await query("SELECT 1 AS ok"); respond(res, 200, { status: "ok", database: "connected" }); return; }
        const user = await authenticate(req);
        if (path === "/api/me" && req.method === "GET") { respond(res, 200, { user }); return; }
        if (["/api/auth/register", "/api/auth/login", "/api/auth/guest"].includes(path) && req.method === "POST") {
            const key = req.socket.remoteAddress || "local";
            const previous = attempts.get(key);
            const entry = previous && previous.until > Date.now() ? previous : { count: 0, until: Date.now() + 600000 };
            entry.count++; attempts.set(key, entry);
            if (entry.count > 40) { respond(res, 429, { error: "Bạn thử quá nhiều lần. Vui lòng chờ 10 phút." }); return; }
            if (user) { respond(res, 409, { error: "Hãy đăng xuất trước khi đổi tài khoản" }); return; }
            const data = await body(req);
            const username = typeof data.username === "string" ? data.username.trim() : "";
            const password = typeof data.password === "string" ? data.password : "";
            if (password.length > 128) { respond(res, 400, { error: "Mật khẩu quá dài" }); return; }
            try {
                const account = path.endsWith("login") ? await login(username, password) : await register(username, password, path.endsWith("guest"));
                await createSession(account, res, sessionScope(req));
                respond(res, 200, { user: account });
            } catch (error) {
                const message = error instanceof Error ? error.message : "";
                if (/^(Tên đăng nhập|Tên đăng nhập gồm)/.test(message)) respond(res, 400, { error: message });
                else throw error;
            }
            return;
        }
        if (!user) { respond(res, 401, { error: "Vui lòng đăng nhập hoặc chọn chơi khách" }); return; }
        if (path === "/api/auth/logout" && req.method === "POST") {
            await logout(req, res);
            for (const ws of wss.clients) if (users.get(ws)?.id === user.id && scopes.get(ws) === sessionScope(req)) ws.close(4001, "Signed out");
            respond(res, 200, { ok: true }); return;
        }
        if (path === "/api/games" && req.method === "GET") {
            const games = await query("SELECT TOP 100 g.Id AS id,g.RoomCode AS code,g.Status AS status,g.Result AS result,g.CreatedAt AS createdAt,g.UpdatedAt AS updatedAt,w.Username AS whiteName,b.Username AS blackName FROM dbo.Games g JOIN dbo.Users w ON w.Id=g.WhiteId LEFT JOIN dbo.Users b ON b.Id=g.BlackId WHERE g.WhiteId=? OR g.BlackId=? ORDER BY g.CreatedAt DESC", [user.id, user.id]);
            respond(res, 200, { games }); return;
        }
        const match = /^\/api\/games\/([a-f0-9-]{36})$/.exec(path);
        if (match && req.method === "GET") {
            const rows = await query<{ Snapshot: string }>("SELECT Snapshot FROM dbo.Games WHERE Id=? AND (WhiteId=? OR BlackId=?)", [match[1], user.id, user.id]);
            if (!rows[0]) { respond(res, 404, { error: "Không tìm thấy ván cờ" }); return; }
            const game = JSON.parse(rows[0].Snapshot);
            respond(res, 200, { game: { id: game.gameId, code: game.code, white: game.white.username, black: game.black?.username || "Chưa có đối thủ", pgn: game.pgn, result: game.result, status: game.status, minutes: game.minutes } }); return;
        }
        respond(res, 404, { error: "Không tìm thấy trang" });
    })().catch(error => { console.error("API error", error); if (!res.headersSent) respond(res, error instanceof SyntaxError ? 400 : 503, { error: error instanceof SyntaxError ? "Dữ liệu không hợp lệ" : "Không thể xử lý lúc này. Vui lòng thử lại." }); });
});
server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws" || (req.headers.origin && !allowedOrigins.has(req.headers.origin))) { socket.destroy(); return; }
    void authenticate(req).then(user => {
        if (!user) { socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); socket.destroy(); return; }
        wss.handleUpgrade(req, socket, head, ws => {
            users.set(ws, user);
            scopes.set(ws, sessionScope(req));
            let alive = true;
            let count = 0;
            let windowAt = Date.now();
            ws.on("pong", () => { alive = true; });
            ws.on("error", error => console.error("WebSocket error", error.message));
            const heartbeat = setInterval(() => { if (!alive) ws.terminate(); else { alive = false; ws.ping(); } }, 15000);
            const ready = gameManager.connect(user, ws);
            void ready.catch(() => ws.close(1011, "Storage unavailable"));
            ws.on("message", data => {
                if (Date.now() - windowAt > 1000) { windowAt = Date.now(); count = 0; }
                if (++count > 30) { ws.close(1008, "Too many messages"); return; }
                let parsed: unknown;
                try { parsed = JSON.parse(data.toString()); } catch { return; }
                void ready.then(() => gameManager.handle(user, ws, parsed)).catch(() => {
                    if (ws.readyState === 1) ws.send(JSON.stringify({ type: "room_error", payload: { message: "Chưa lưu được dữ liệu. Nước đi chưa được xác nhận; vui lòng thử lại." } }));
                });
            });
            ws.on("close", () => { clearInterval(heartbeat); void ready.then(() => gameManager.disconnect(user, ws)).catch(error => console.error(error)); });
        });
    }).catch(() => socket.destroy());
});
let ticking = false;
const timer = setInterval(() => {
    for (const [ip, entry] of attempts) if (entry.until < Date.now()) attempts.delete(ip);
    if (ticking) return;
    ticking = true;
    void gameManager.tick().catch(error => console.error(error)).finally(() => { ticking = false; });
}, 1000);
server.on("close", () => clearInterval(timer));
server.listen(port, host, () => {
    console.log(`KingOfChess listening on ${host}:${port}; SQL Server connected`);
    for (const origin of allowedOrigins) if (origin.endsWith(`:${port}`)) console.log(`Open ${origin}`);
    if (!config.secureCookies) console.log("HTTP demo mode: use HTTPS and COOKIE_SECURE=true before public deployment.");
});
