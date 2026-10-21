import { randomBytes, randomUUID, scrypt as derive, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import type { IncomingMessage, ServerResponse } from "node:http";
import { query } from "./database.js";
import { config } from "./config.js";

const scrypt = promisify(derive);
export type User = { id: string; username: string; isGuest: boolean };
type UserRow = { Id: string; Username: string; PasswordHash: string | null; IsGuest: boolean };
const publicUser = (row: UserRow): User => ({ id: row.Id.toLowerCase(), username: row.Username, isGuest: Boolean(row.IsGuest) });
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const tokenOf = (req: IncomingMessage) => req.headers.cookie?.split(";").map(value => value.trim()).find(value => value.startsWith("kc_session="))?.slice(11) || "";

export async function authenticate(req: IncomingMessage) {
    const token = tokenOf(req);
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const rows = await query<UserRow>("SELECT u.Id,u.Username,u.IsGuest FROM dbo.Users u JOIN dbo.Sessions s ON u.Id=s.UserId WHERE s.TokenHash=? AND s.ExpiresAt>SYSUTCDATETIME()", [digest(token)]);
    return rows[0] ? publicUser(rows[0]) : null;
}

export async function login(username: string, password: string) {
    const rows = await query<UserRow>("SELECT TOP 1 * FROM dbo.Users WHERE Username=? AND IsGuest=0", [username.toLowerCase()]);
    const row = rows[0];
    const [salt, hash] = row?.PasswordHash?.split(":") || ["00000000000000000000000000000000", "0".repeat(128)];
    const actual = await scrypt(password, salt!, 64) as Buffer;
    if (!row || !hash || !timingSafeEqual(actual, Buffer.from(hash, "hex"))) throw new Error("Tên đăng nhập hoặc mật khẩu không đúng");
    return publicUser(row);
}

export async function register(username: string, password: string, guest = false) {
    if (!guest && (!/^[a-zA-Z0-9_]{3,24}$/.test(username) || password.length < 8 || password.length > 128)) throw new Error("Tên đăng nhập gồm 3–24 chữ, số hoặc dấu _. Mật khẩu cần 8–128 ký tự.");
    const id = randomUUID();
    const name = guest ? `khach_${id.slice(0, 8)}` : username.toLowerCase();
    const salt = randomBytes(16).toString("hex");
    const hash = guest ? null : `${salt}:${(await scrypt(password, salt, 64) as Buffer).toString("hex")}`;
    try {
        await query("INSERT dbo.Users(Id,Username,PasswordHash,IsGuest) VALUES(?,?,?,?)", [id, name, hash, guest ? 1 : 0]);
    } catch (error) {
        if (/duplicate|unique|2627|2601/i.test(String(error))) throw new Error("Tên đăng nhập đã được sử dụng");
        throw error;
    }
    return { id, username: name, isGuest: guest };
}

export async function createSession(user: User, res: ServerResponse) {
    const token = randomBytes(32).toString("hex");
    await query("INSERT dbo.Sessions(TokenHash,UserId,ExpiresAt) VALUES(?,?,DATEADD(day,7,SYSUTCDATETIME()))", [digest(token), user.id]);
    res.setHeader("Set-Cookie", `kc_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${config.secureCookies ? "; Secure" : ""}`);
}

export async function logout(req: IncomingMessage, res: ServerResponse) {
    await query("DELETE dbo.Sessions WHERE TokenHash=?", [digest(tokenOf(req))]);
    res.setHeader("Set-Cookie", `kc_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${config.secureCookies ? "; Secure" : ""}`);
}
