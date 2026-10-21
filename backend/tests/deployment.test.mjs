import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { runtimeConfig } from "../dist/config.js";
import { serveFrontend } from "../dist/static.js";

test("LAN origins follow machine IPv4 and configured port; HTTPS cookies configurable", () => {
    const addresses = { Ethernet: [{ family: "IPv4", address: "192.168.10.22", internal: false }] };
    const lan = runtimeConfig({ PORT: "9090", LAN_MODE: "true", COOKIE_SECURE: "false", NODE_ENV: "production" }, addresses);
    assert.ok(lan.origins.has("http://192.168.10.22:9090"));
    assert.equal(lan.secureCookies, false);
    const secure = runtimeConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "https://chess.example.test" }, addresses);
    assert.equal(secure.secureCookies, true);
    assert.ok(secure.origins.has("https://chess.example.test"));
    assert.ok(!secure.origins.has("http://192.168.10.22:8080"));
    assert.throws(() => runtimeConfig({ PORT: "abc" }));
    assert.throws(() => runtimeConfig({ ALLOWED_ORIGINS: "https://example.test/path" }));
});

test("built frontend serves deep links and assets without exposing source or env", async () => {
    const server = createServer((req, res) => {
        void serveFrontend(req, res, new URL(req.url, "http://localhost").pathname).then(handled => {
            if (!handled) { res.writeHead(418); res.end(); }
        });
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        for (const path of ["/", "/rooms", "/account", "/history"]) {
            const response = await fetch(base + path);
            assert.equal(response.status, 200);
            assert.match(await response.text(), /<div id="root">/);
        }
        const html = await (await fetch(base)).text();
        const asset = html.match(/src="([^"]+\.js)"/)[1];
        assert.equal((await fetch(base + asset)).status, 200);
        for (const path of ["/.env", "/backend/src/auth.ts", "/%2e%2e%5c.env", "/missing.js"]) assert.equal((await fetch(base + path)).status, 404);
        assert.equal((await fetch(base + "/api/me")).status, 418);
        assert.equal((await fetch(base + "/", { method: "HEAD" })).status, 200);
        assert.equal((await fetch(base + "/", { method: "POST" })).status, 405);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
