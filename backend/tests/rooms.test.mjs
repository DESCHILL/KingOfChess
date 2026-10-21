import { test } from "node:test";
import assert from "node:assert/strict";
import { RoomManager } from "../dist/RoomManager.js";

function fixture() {
    let now = 1000000;
    const rooms = new Map();
    const games = new Map();
    let fail = false;
    const store = {
        load: async () => [...rooms.values()].map(room => structuredClone(room)),
        save: async room => { if (fail) throw new Error("Simulated database failure"); rooms.set(room.code, structuredClone(room)); games.set(room.gameId, structuredClone(room)); },
        remove: async code => { rooms.delete(code); },
    };
    let manager = new RoomManager(store, () => now);
    const user = name => ({ id: name, username: name, isGuest: false });
    const socket = () => ({ readyState: 1, messages: [], send(text) { this.messages.push(JSON.parse(text)); } });
    const a = user("alice"), b = user("bob"), c = user("viewer");
    const x = socket(), y = socket(), z = socket();
    const last = (ws, type = "room_state") => ws.messages.filter(message => message.type === type).at(-1)?.payload;
    const send = (u, ws, data) => manager.handle(u, ws, data);
    const move = (u, ws, from, to) => { const state = last(ws); return send(u, ws, { type: "room_move", gameId: state.gameId, revision: state.revision, move: { from, to } }); };
    return { a, b, c, x, y, z, last, send, move, games, rooms, advance: ms => { now += ms; }, failure: value => { fail = value; }, get manager() { return manager; }, restart: async () => { manager = new RoomManager(store, () => now); await manager.initialize(); }, connect: async () => { await manager.connect(a, x); await manager.connect(b, y); await manager.connect(c, z); }, start: async (minutes = 10) => { await manager.connect(a, x); await manager.connect(b, y); await manager.connect(c, z); await send(a, x, { type: "room_create", minutes }); await send(b, y, { type: "room_join", code: ` ${last(x).code.toLowerCase()} ` }); } };
}

test("room seats, spectators, permissions, duplicate moves and rematch history", async () => {
    const f = fixture(); await f.start();
    assert.equal(f.last(f.x).role, "white"); assert.equal(f.last(f.y).role, "black");
    await f.send(f.c, f.z, { type: "room_join", code: "000000" });
    assert.equal(f.last(f.z, "room_error").message, "Phòng không tồn tại");
    await f.send(f.c, f.z, { type: "room_join", code: f.last(f.x).code });
    assert.equal(f.last(f.z).role, "spectator");
    await f.move(f.c, f.z, "e2", "e4"); assert.match(f.last(f.z, "room_error").message, /quyền/);
    await f.move(f.b, f.y, "e7", "e5"); assert.match(f.last(f.y, "room_error").message, /quyền/);
    await f.move(f.a, f.x, "e2", "e5"); assert.match(f.last(f.x, "room_error").message, /không hợp lệ/);
    const old = f.last(f.x);
    f.advance(5000); await f.move(f.a, f.x, "e2", "e4");
    assert.equal(f.last(f.z).clock.white, 595000);
    await f.send(f.a, f.x, { type: "room_move", gameId: old.gameId, revision: old.revision, move: { from: "e2", to: "e4" } });
    assert.match(f.last(f.x).pgn, /e4/);
    assert.equal(f.last(f.x).clock.white, 595000);
    await f.send(f.c, f.z, { type: "room_restart", round: 1 }); assert.match(f.last(f.z, "room_error").message, /Chỉ người chơi/);
    await f.send(f.a, f.x, { type: "room_restart", round: 1 });
    assert.equal(f.last(f.y).restartPending, true);
    await f.send(f.b, f.y, { type: "room_restart", round: 1, cancel: true });
    assert.equal(f.last(f.x).restartPending, false);
    await f.send(f.a, f.x, { type: "room_restart", round: 1 });
    await f.send(f.b, f.y, { type: "room_restart", round: 1 });
    assert.equal(f.last(f.x).role, "black"); assert.equal(f.last(f.z).round, 2);
    assert.equal(f.last(f.z).clock.white, 600000);
    assert.equal(f.games.get(old.gameId).result.reason, "restarted");
    assert.equal(f.games.size, 2);
    await f.send(f.a, f.x, { type: "room_restart", round: 1 });
    assert.equal(f.last(f.x).restartPending, false);
});

test("reconnect preserves seat, moves and server clock; duplicate tabs are one player", async () => {
    const f = fixture(); await f.start();
    await f.move(f.a, f.x, "e2", "e4");
    await f.manager.disconnect(f.a, f.x);
    f.advance(30000);
    await f.manager.connect(f.a, f.x);
    await f.send(f.a, f.x, { type: "room_sync" });
    assert.equal(f.last(f.x).role, "white"); assert.match(f.last(f.x).pgn, /e4/);
    assert.equal(f.last(f.x).clock.black, 570000);
    await f.manager.connect(f.a, f.z);
    await f.manager.disconnect(f.a, f.x);
    assert.equal(f.last(f.y).whiteOnline, true);
});

test("disconnect grace and timeout finish games without further moves", async () => {
    const f = fixture(); await f.start(3);
    await f.manager.disconnect(f.b, f.y); f.advance(120001); await f.manager.tick();
    assert.equal(f.last(f.x).result.reason, "disconnect"); assert.equal(f.last(f.x).result.winner, "white");
    const g = fixture(); await g.start(3); g.advance(180001); await g.manager.tick();
    assert.equal(g.last(g.y).result.reason, "timeout"); assert.equal(g.last(g.y).clock.white, 0);
    await g.move(g.a, g.x, "e2", "e4"); assert.equal(g.last(g.y).status, "finished");
});

test("backend restart restores saved PGN and deducts elapsed time", async () => {
    const f = fixture(); await f.start(); await f.move(f.a, f.x, "e2", "e4");
    const gameId = f.last(f.x).gameId;
    f.advance(40000); await f.restart(); await f.connect();
    await f.send(f.a, f.x, { type: "room_sync" });
    assert.equal(f.last(f.x).gameId, gameId); assert.equal(f.last(f.x).clock.black, 560000);
    assert.equal(f.last(f.x).role, "white"); assert.match(f.last(f.x).pgn, /e4/);
});

test("database failure does not accept an unsaved move", async () => {
    const f = fixture(); await f.start(); const before = f.last(f.x);
    f.failure(true); await assert.rejects(f.move(f.a, f.x, "e2", "e4"));
    f.failure(false); await f.send(f.a, f.x, { type: "room_sync" });
    assert.equal(f.last(f.x).pgn, before.pgn); assert.equal(f.last(f.x).revision, before.revision);
    await f.move(f.a, f.x, "e2", "e4"); assert.match(f.last(f.y).pgn, /e4/);
});

test("quick matchmaking uses same clock and durable state; checkmate can rematch", async () => {
    const f = fixture(); await f.connect();
    await f.send(f.a, f.x, { type: "init_game", minutes: 5 });
    await f.send(f.b, f.y, { type: "init_game", minutes: 5 });
    assert.equal(f.last(f.x).gameId, f.last(f.y).gameId);
    await f.move(f.a, f.x, "f2", "f3"); await f.move(f.b, f.y, "e7", "e5");
    await f.move(f.a, f.x, "g2", "g4"); await f.move(f.b, f.y, "d8", "h4");
    assert.equal(f.last(f.x).result.reason, "checkmate");
    const id = f.last(f.x).gameId;
    await f.send(f.a, f.x, { type: "room_restart", round: 1 }); await f.send(f.b, f.y, { type: "room_restart", round: 1 });
    assert.notEqual(f.last(f.x).gameId, id); assert.equal(f.games.get(id).result.winner, "black");
    await f.send(f.b, f.y, { type: "room_leave" });
    assert.equal(f.last(f.x).result.reason, "player_left");
    await f.send(f.a, f.x, { type: "room_restart", round: 2 });
    assert.equal(f.last(f.x).status, "waiting");
    await f.send(f.c, f.z, { type: "init_game", minutes: 5 });
    assert.equal(f.last(f.z).role, "black");
});
