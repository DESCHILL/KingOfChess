import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);

export function runtimeConfig(env: NodeJS.ProcessEnv = process.env, addresses = networkInterfaces()) {
    const port = Number(env.PORT || 8080);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535");
    const origins = new Set([`http://localhost:${port}`, `http://127.0.0.1:${port}`, "http://localhost:5173", "http://127.0.0.1:5173"]);
    if (env.LAN_MODE === "true") {
        for (const entries of Object.values(addresses)) for (const entry of entries || []) {
            if (entry.family === "IPv4" && !entry.internal) origins.add(`http://${entry.address}:${port}`);
        }
    }
    for (const value of (env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean)) {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol) || url.origin !== value) throw new Error("ALLOWED_ORIGINS must contain origins without a trailing slash");
        origins.add(value);
    }
    if (env.COOKIE_SECURE && !["true", "false"].includes(env.COOKIE_SECURE)) throw new Error("COOKIE_SECURE must be true or false");
    return { port, host: env.HOST || "127.0.0.1", origins, secureCookies: env.COOKIE_SECURE ? env.COOKIE_SECURE === "true" : env.NODE_ENV === "production" };
}

export const config = runtimeConfig();
