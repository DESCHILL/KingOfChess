import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import WebSocket, { WebSocketServer } from "ws";
import { GameManager } from "../dist/GameManager.js";

test("rooms: seats, viewers, validation, isolation, completion and cleanup", async () => {
    const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
    const manager = new GameManager();
    server.on("connection", ws => {
        manager.addUser(ws);
        ws.on("close", () => manager.removeUser(ws));
    });
    await once(server, "listening");
    const clients = [];
    const connect = async () => {
        const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
        const messages = [];
        socket.on("message", value => messages.push(JSON.parse(value)));
        clients.push(socket);
        await once(socket, "open");
        return {
            socket,
            send: (type, payload = {}) => socket.send(JSON.stringify({ type, ...payload })),
            next: async (type, predicate = () => true) => {
                for (let i = 0; i < 100; i++) {
                    const index = messages.findIndex(message => message.type === type && predicate(message.payload));
                    if (index >= 0) return messages.splice(index, 1)[0].payload;
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                throw new Error(`Missing ${type}`);
            },
        };
    };
    try {
        const a = await connect();
        const b = await connect();
        const c = await connect();
        a.send("room_create");
        const room = await a.next("room_state");
        assert.equal(room.role, "white");
        assert.equal(room.status, "waiting");
        assert.match(room.code, /^[A-Z2-9]{6}$/);
        b.send("room_join", { code: `  ${room.code.toLowerCase()}  ` });
        c.send("room_join", { code: room.code });
        const [bs, cs] = await Promise.all([b.next("room_state"), c.next("room_state")]);
        assert.deepEqual([bs.role, cs.role].sort(), ["black", "spectator"]);
        const black = bs.role === "black" ? b : c;
        const viewer = bs.role === "spectator" ? b : c;
        const p = await a.next("room_state", state => state.viewers === 1);
        assert.equal(p.players, 2);
        viewer.send("room_move", { move: { from: "f2", to: "f3" } });
        await viewer.next("room_error");
        black.send("room_move", { move: { from: "e7", to: "e5" } });
        await black.next("room_error");
        a.send("room_move", { move: { from: "e2", to: "e5" } });
        await a.next("room_error");
        a.send("room_move", { move: { from: "f2", to: "f3" } });
        const moved = await viewer.next("room_state", state => state.pgn.includes("f3"));
        assert.ok(moved.fen.includes(" b "));
        const late = await connect();
        late.send("room_join", { code: room.code });
        const snapshot = await late.next("room_state");
        assert.equal(snapshot.role, "spectator");
        assert.equal(snapshot.fen, moved.fen);
        late.send("room_leave");
        await late.next("room_left");
        late.send("room_join", { code: "000000" });
        assert.equal((await late.next("room_error")).message, "Phòng không tồn tại");
        late.send("room_create");
        const other = await late.next("room_state");
        assert.notEqual(other.code, room.code);
        for (const [who, from, to, san] of [[black, "e7", "e5", "e5"], [a, "g2", "g4", "g4"], [black, "d8", "h4", "Qh4#"]]) {
            who.send("room_move", { move: { from, to } });
            await viewer.next("room_state", state => state.pgn.includes(san));
        }
        const ended = await a.next("room_state", state => state.status === "finished");
        assert.equal(ended.result.winner, "black");
        assert.equal(ended.result.reason, "checkmate");
        viewer.send("room_restart", { round: 1 });
        await viewer.next("room_error");
        a.send("room_restart", { round: 1 });
        const proposed = await black.next("room_state", state => state.restartPending);
        assert.equal(proposed.round, 1);
        assert.equal(proposed.status, "finished");
        black.send("room_restart", { round: 1, cancel: true });
        await a.next("room_state", state => state.round === 1 && state.status === "finished" && !state.restartPending);
        a.send("room_restart", { round: 1 });
        black.send("room_restart", { round: 1 });
        const replay = await viewer.next("room_state", state => state.round === 2);
        assert.equal(replay.status, "playing");
        assert.equal(replay.result, null);
        assert.equal(replay.code, room.code);
        assert.equal(replay.fen, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
        assert.equal((await a.next("room_state", state => state.round === 2)).role, "black");
        a.send("room_restart", { round: 1 });
        assert.equal((await a.next("room_state", state => state.round === 2 && !state.restartPending)).round, 2);
        viewer.send("room_move", { move: { from: "e2", to: "e4" } });
        await viewer.next("room_error");
        for (const who of [a, b, c]) {
            who.send("room_leave");
            await who.next("room_left");
        }
        a.send("room_join", { code: room.code });
        await a.next("room_error");
        a.send("room_join", { code: other.code });
        assert.equal((await a.next("room_state", state => state.code === other.code)).role, "black");
        a.socket.close();
        const disconnected = await late.next("room_state", state => state.status === "finished");
        assert.equal(disconnected.result.winner, "white");
        late.send("room_restart", { round: 1 });
        const reopened = await late.next("room_state", state => state.round === 2);
        assert.equal(reopened.status, "waiting");
        assert.equal(reopened.players, 1);
        b.send("init_game");
        c.send("init_game");
        const initialB = await b.next("init_game");
        const initialC = await c.next("init_game");
        assert.deepEqual([initialB.color, initialC.color].sort(), ["black", "white"]);
        b.send("restart_game", { round: 1 });
        assert.equal((await c.next("restart_state")).pending, true);
        c.send("restart_game", { round: 1, cancel: true });
        await b.next("restart_state", state => !state.pending);
        b.send("restart_game", { round: 1 });
        c.send("restart_game", { round: 1 });
        const secondB = await b.next("init_game");
        const secondC = await c.next("init_game");
        assert.equal(secondB.round, 2);
        assert.notEqual(secondB.color, initialB.color);
        assert.notEqual(secondC.color, initialC.color);
        const white = secondB.color === "white" ? b : c;
        const dark = secondB.color === "black" ? b : c;
        for (const [who, otherPlayer, from, to] of [[white, dark, "f2", "f3"], [dark, white, "e7", "e5"], [white, dark, "g2", "g4"], [dark, white, "d8", "h4"]]) {
            who.send("move", { move: { from, to } });
            await otherPlayer.next("move");
        }
        assert.equal((await b.next("game_over")).reason, "checkmate");
        assert.equal((await c.next("game_over")).reason, "checkmate");
        b.send("restart_game", { round: 2 });
        c.send("restart_game", { round: 2 });
        assert.equal((await b.next("init_game")).round, 3);
        assert.equal((await c.next("init_game")).round, 3);
    } finally {
        for (const client of clients) client.terminate();
        await new Promise(resolve => server.close(resolve));
    }
});
