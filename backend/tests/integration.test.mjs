import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import WebSocket from "ws";
import { query } from "../dist/database.js";

test("SQL Server and HTTP: accounts, sessions, saved games, reconnect and private history", async () => {
    const base = process.env.TEST_URL || "http://localhost:8080";
    const ids = [];
    const sockets = [];
    const credentials = [];
    const request = async (path, data, cookie = "") => {
        const response = await fetch(`${base}/api${path}`, { headers: { "Content-Type": "application/json", Origin: new URL(base).origin, ...(cookie ? { Cookie: cookie } : {}) }, ...(data === undefined ? {} : { method: "POST", body: JSON.stringify(data) }) });
        return { status: response.status, data: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] || cookie };
    };
    const connect = async cookie => {
        const ws = new WebSocket(base.replace("http", "ws") + "/ws", { headers: { Cookie: cookie, Origin: new URL(base).origin } });
        const messages = [];
        ws.on("message", raw => messages.push(JSON.parse(raw)));
        sockets.push(ws);
        await new Promise((resolve, reject) => { ws.once("open", resolve); ws.once("error", reject); });
        return {
            ws,
            send: (type, extra = {}) => ws.send(JSON.stringify({ type, ...extra })),
            next: async (type, predicate = () => true) => {
                for (let i = 0; i < 200; i++) {
                    const index = messages.findIndex(message => message.type === type && predicate(message.payload));
                    if (index >= 0) return messages.splice(index, 1)[0].payload;
                    await new Promise(resolve => setTimeout(resolve, 25));
                }
                throw new Error(`Missing ${type}: ${JSON.stringify(messages)}`);
            },
        };
    };
    try {
        assert.equal((await fetch(`${base}/api/me`, { headers: { Origin: "https://not-allowed.invalid" } })).status, 403);
        assert.equal((await request("/health")).data.database, "connected");
        assert.equal((await request("/games")).status, 401);
        assert.equal((await request("/auth/register", { username: "ab", password: "123" })).status, 400);
        for (let i = 0; i < 3; i++) {
            const username = `test_${randomBytes(6).toString("hex")}`;
            const password = randomBytes(20).toString("hex");
            const response = await request("/auth/register", { username, password });
            assert.equal(response.status, 200, JSON.stringify(response.data));
            ids.push(response.data.user.id);
            credentials.push({ username, password, cookie: response.cookie });
        }
        const [alice, bob, viewer] = credentials;
        assert.equal((await request("/auth/register", { username: alice.username, password: alice.password })).status, 400);
        assert.equal((await request("/auth/login", { username: alice.username, password: "wrongpassword" })).status, 400);
        const signedIn = await request("/auth/login", { username: alice.username, password: alice.password });
        assert.equal(signedIn.status, 200);
        assert.equal((await request("/me", undefined, signedIn.cookie)).data.user.id, ids[0]);
        const rows = await query("SELECT PasswordHash FROM dbo.Users WHERE Id=?", [ids[0]]);
        assert.ok(rows[0].PasswordHash.includes(":")); assert.ok(!rows[0].PasswordHash.includes(alice.password));
        const a = await connect(alice.cookie), b = await connect(bob.cookie), c = await connect(viewer.cookie);
        a.send("room_create", { minutes: 3 });
        const created = await a.next("room_state");
        b.send("room_join", { code: created.code });
        await b.next("room_state");
        c.send("room_join", { code: created.code }); await c.next("room_state");
        a.send("room_sync");
        const ready = await a.next("room_state", state => state.players === 2 && state.viewers === 1);
        a.send("room_move", { gameId: ready.gameId, revision: ready.revision, move: { from: "e2", to: "e4" } });
        const played = await b.next("room_state", state => state.pgn.includes("e4"));
        assert.ok(played.clock.white <= 180000);
        const detail = await request(`/games/${created.gameId}`, undefined, alice.cookie);
        assert.match(detail.data.game.pgn, /e4/);
        assert.equal((await request(`/games/${created.gameId}`, undefined, viewer.cookie)).status, 404);
        a.ws.close();
        const reconnected = await connect(signedIn.cookie);
        reconnected.send("room_sync");
        const recovered = await reconnected.next("room_state", state => state.pgn.includes("e4"));
        assert.equal(recovered.role, "white"); assert.equal(recovered.gameId, created.gameId);
        await b.next("room_clock", state => state.clock.black < 179500);
        b.send("room_leave"); await b.next("room_left");
        await reconnected.next("room_state", state => state.status === "finished");
        const final = await request(`/games/${created.gameId}`, undefined, bob.cookie);
        assert.equal(final.data.game.result.winner, "white");
        assert.ok((await request("/games", undefined, alice.cookie)).data.games.some(game => game.id.toLowerCase() === created.gameId));
        reconnected.send("room_leave"); await reconnected.next("room_left");
        c.send("room_leave"); await c.next("room_left");
        await request("/auth/logout", {}, signedIn.cookie);
        assert.equal((await request("/me", undefined, signedIn.cookie)).data.user, null);
    } finally {
        for (const ws of sockets) ws.close();
        await new Promise(resolve => setTimeout(resolve, 150));
        for (const id of ids) {
            await query("DELETE dbo.Rooms WHERE JSON_VALUE(Snapshot,'$.white.id')=? OR JSON_VALUE(Snapshot,'$.black.id')=?; DELETE dbo.Games WHERE WhiteId=? OR BlackId=?; DELETE dbo.Sessions WHERE UserId=?; DELETE dbo.Users WHERE Id=? AND Username LIKE 'test[_]%'", [id, id, id, id, id, id]);
        }
    }
});
