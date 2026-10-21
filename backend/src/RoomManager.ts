import { randomInt, randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import type WebSocket from "ws";
import type { User } from "./auth.js";
import { MoveSchema } from "./messages.js";

type Player = { id: string; username: string };
type Result = { winner: "white" | "black" | null; reason: string };
export type SavedRoom = {
    code: string; gameId: string; mode: "room" | "quick";
    white: Player; black: Player | null; members: string[];
    status: "waiting" | "playing" | "finished";
    pgn: string; result: Result | null; round: number; revision: number;
    minutes: number; whiteMs: number; blackMs: number; turnAt: number;
    offline: Record<string, number>; restart: string[];
    createdAt: number; updatedAt: number;
};
export interface RoomStore {
    load(): Promise<SavedRoom[]>;
    save(room: SavedRoom): Promise<void>;
    remove(code: string): Promise<void>;
}
const graceMs = 120000;
export class RoomManager {
    private rooms = new Map<string, SavedRoom>();
    private clients = new Map<string, Set<WebSocket>>();
    private queue: Promise<void> = Promise.resolve();
    constructor(private store: RoomStore, private now: () => number = Date.now) {}

    async initialize() {
        for (const room of await this.store.load()) {
            room.restart = [];
            for (const player of [room.white, room.black]) {
                if (player && room.members.includes(player.id)) room.offline[player.id] ??= this.now();
            }
            this.rooms.set(room.code, room);
            await this.store.save(room);
        }
        await this.tick();
    }
    private serialize(task: () => Promise<void>) {
        const next = this.queue.then(task);
        this.queue = next.catch(error => console.error("Room operation failed", error));
        return next;
    }
    private send(ws: WebSocket, type: string, payload: unknown) {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type, payload }));
    }
    private find(id: string) { return [...this.rooms.values()].find(room => room.members.includes(id)); }
    private online(id: string) { return Boolean(this.clients.get(id)?.size); }
    private board(room: SavedRoom) { const board = new Chess(); if (room.pgn) board.loadPgn(room.pgn); return board; }
    private remaining(room: SavedRoom, now = this.now()) {
        const turn = this.board(room).turn();
        const elapsed = room.status === "playing" ? Math.max(0, now - room.turnAt) : 0;
        return { white: Math.max(0, room.whiteMs - (turn === "w" ? elapsed : 0)), black: Math.max(0, room.blackMs - (turn === "b" ? elapsed : 0)) };
    }
    private payload(room: SavedRoom, id: string) {
        return {
            ...room, members: undefined, offline: undefined, restart: undefined,
            role: room.white.id === id ? "white" : room.black?.id === id ? "black" : "spectator",
            fen: this.board(room).fen(),
            viewers: room.members.filter(member => member !== room.white.id && member !== room.black?.id).length,
            players: [room.white, room.black].filter(player => player && room.members.includes(player.id)).length,
            whiteOnline: this.online(room.white.id), blackOnline: Boolean(room.black && this.online(room.black.id)),
            reconnectSeconds: Object.fromEntries(Object.entries(room.offline).map(([user, since]) => [user, Math.max(0, Math.ceil((graceMs - (this.now() - since)) / 1000))])),
            clock: this.remaining(room), turn: this.board(room).turn(),
            restartRequested: room.restart.includes(id), restartPending: room.restart.length > 0,
        };
    }
    private broadcast(room: SavedRoom, type = "room_state") {
        for (const id of room.members) for (const ws of this.clients.get(id) || []) {
            this.send(ws, type, type === "room_clock" ? { code: room.code, clock: this.remaining(room), whiteOnline: this.online(room.white.id), blackOnline: Boolean(room.black && this.online(room.black.id)), reconnectSeconds: this.payload(room, id).reconnectSeconds } : this.payload(room, id));
        }
    }
    private async commit(room: SavedRoom) {
        room.updatedAt = this.now();
        room.revision++;
        await this.store.save(room);
        this.rooms.set(room.code, structuredClone(room));
        this.broadcast(room);
    }
    private finish(room: SavedRoom, result: Result, at = this.now()) {
        const time = this.remaining(room, at);
        room.whiteMs = time.white; room.blackMs = time.black;
        room.status = "finished"; room.result = result; room.restart = [];
    }
    private expire(room: SavedRoom) {
        if (room.status !== "playing") return false;
        const clock = this.remaining(room);
        if (clock.white <= 0 || clock.black <= 0) {
            const winner = this.board(room).isInsufficientMaterial() ? null : clock.white <= 0 ? "black" : "white";
            this.finish(room, { winner, reason: "timeout" });
            return true;
        }
        const expired = [room.white, room.black].filter(player => player && room.offline[player.id] !== undefined && this.now() - room.offline[player.id]! >= graceMs);
        if (expired.length) {
            this.finish(room, { winner: expired.length === 2 ? null : expired[0]?.id === room.white.id ? "black" : "white", reason: "disconnect" });
            return true;
        }
        return false;
    }
    async connect(user: User, ws: WebSocket) {
        return this.serialize(async () => {
            const sockets = this.clients.get(user.id) || new Set<WebSocket>();
            sockets.add(ws); this.clients.set(user.id, sockets);
            const existing = this.find(user.id);
            if (existing) {
                const room = structuredClone(existing);
                this.expire(room); delete room.offline[user.id];
                await this.commit(room);
            }
        });
    }
    async disconnect(user: User, ws: WebSocket) {
        return this.serialize(async () => {
            this.clients.get(user.id)?.delete(ws);
            if (this.online(user.id)) return;
            this.clients.delete(user.id);
            const existing = this.find(user.id);
            if (!existing) return;
            const room = structuredClone(existing);
            if (room.white.id === user.id || room.black?.id === user.id) room.offline[user.id] = this.now();
            else room.members = room.members.filter(id => id !== user.id);
            room.restart = [];
            await this.commit(room);
        });
    }
    async tick() {
        return this.serialize(async () => {
            for (const existing of this.rooms.values()) {
                const room = structuredClone(existing);
                if (this.expire(room)) await this.commit(room);
                else if (room.status === "playing") this.broadcast(room, "room_clock");
                if (room.status === "waiting" && room.offline[room.white.id] !== undefined && this.now() - room.offline[room.white.id]! >= graceMs) {
                    this.finish(room, { winner: null, reason: "cancelled" });
                    await this.commit(room);
                }
                if (!room.members.some(id => this.online(id)) && room.status === "finished" && this.now() - room.updatedAt > graceMs) {
                    await this.store.remove(room.code); this.rooms.delete(room.code);
                }
            }
        });
    }
    async handle(user: User, ws: WebSocket, raw: unknown) {
        return this.serialize(async () => {
            if (!raw || typeof raw !== "object" || !("type" in raw)) return;
            const data = raw as Record<string, unknown>;
            const type = data.type;
            const existing = this.find(user.id);
            const error = (message: string) => this.send(ws, "room_error", { message });
            if (type === "room_sync") {
                if (existing) this.send(ws, "room_state", this.payload(existing, user.id));
                else this.send(ws, "room_left", {});
                return;
            }
            if (type === "room_leave") {
                if (existing) {
                    const room = structuredClone(existing);
                    if ((room.white.id === user.id || room.black?.id === user.id) && room.status !== "finished") this.finish(room, { winner: room.status === "playing" ? (room.white.id === user.id ? "black" : "white") : null, reason: "player_left" });
                    room.members = room.members.filter(id => id !== user.id);
                    delete room.offline[user.id]; room.restart = [];
                    await this.commit(room);
                    if (!room.members.length) { await this.store.remove(room.code); this.rooms.delete(room.code); }
                }
                for (const client of this.clients.get(user.id) || []) this.send(client, "room_left", {});
                return;
            }
            if (type === "room_create" || type === "room_join" || type === "init_game") {
                if (existing) { this.send(ws, "room_state", this.payload(existing, user.id)); return; }
                const minutes = Number(data.minutes ?? 10);
                if (![3, 5, 10, 15].includes(minutes)) { error("Thời gian mỗi bên phải là 3, 5, 10 hoặc 15 phút"); return; }
                const code = typeof data.code === "string" ? data.code.replace(/\s/g, "").toUpperCase() : "";
                const target = type === "room_join" ? this.rooms.get(code) : type === "init_game" ? [...this.rooms.values()].find(room => room.mode === "quick" && room.status === "waiting" && room.minutes === minutes && this.online(room.white.id)) : undefined;
                if (type === "room_join" && !target) { error("Phòng không tồn tại"); return; }
                if (target) {
                    const room = structuredClone(target);
                    if (room.status === "waiting" && !room.black) {
                        room.black = { id: user.id, username: user.username }; room.status = "playing"; room.turnAt = this.now();
                    }
                    room.members.push(user.id);
                    await this.commit(room);
                } else {
                    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
                    let nextCode: string;
                    do { nextCode = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(""); } while (this.rooms.has(nextCode));
                    await this.commit({ code: nextCode, gameId: randomUUID(), mode: type === "init_game" ? "quick" : "room", white: { id: user.id, username: user.username }, black: null, members: [user.id], status: "waiting", pgn: "", result: null, round: 1, revision: 0, minutes, whiteMs: minutes * 60000, blackMs: minutes * 60000, turnAt: this.now(), offline: {}, restart: [], createdAt: this.now(), updatedAt: this.now() });
                }
                return;
            }
            if (!existing) { error("Bạn chưa ở trong phòng"); return; }
            const room = structuredClone(existing);
            if (this.expire(room)) { await this.commit(room); return; }
            const player = user.id === room.white.id || user.id === room.black?.id;
            if (type === "room_restart") {
                if (!player) { error("Chỉ người chơi được yêu cầu đấu trận mới"); return; }
                if (data.round !== room.round || room.status === "waiting") { this.send(ws, "room_state", this.payload(room, user.id)); return; }
                if (data.cancel) room.restart = [];
                else if (!room.restart.includes(user.id)) room.restart.push(user.id);
                const bothPresent = room.members.includes(room.white.id) && Boolean(room.black && room.members.includes(room.black.id));
                if (!data.cancel && (!bothPresent || room.restart.length === 2)) {
                    if (room.status === "playing") { this.finish(room, { winner: null, reason: "restarted" }); await this.commit(room); }
                    if (bothPresent && room.black) [room.white, room.black] = [room.black, room.white];
                    else { room.white = { id: user.id, username: user.username }; room.black = null; }
                    room.status = room.black ? "playing" : "waiting";
                    room.pgn = ""; room.result = null; room.restart = []; room.offline = {};
                    room.gameId = randomUUID(); room.round++; room.whiteMs = room.minutes * 60000; room.blackMs = room.minutes * 60000;
                    room.turnAt = this.now(); room.createdAt = this.now();
                    for (const p of [room.white, room.black]) if (p && !this.online(p.id)) room.offline[p.id] = this.now();
                }
                await this.commit(room);
                return;
            }
            if (type === "room_move") {
                if (room.status !== "playing") { error("Ván cờ chưa bắt đầu hoặc đã kết thúc"); return; }
                if (data.gameId !== room.gameId || data.revision !== room.revision) { this.send(ws, "room_state", this.payload(room, user.id)); return; }
                const board = this.board(room);
                const mover = board.turn() === "w" ? room.white : room.black;
                const move = MoveSchema.safeParse(data.move);
                if (mover?.id !== user.id || !move.success) { error("Bạn không có quyền đi quân ở lượt này"); return; }
                const time = this.remaining(room);
                try { const { from, to, promotion } = move.data; board.move(promotion ? { from, to, promotion } : { from, to }); }
                catch { error("Nước đi không hợp lệ"); return; }
                room.whiteMs = time.white; room.blackMs = time.black; room.turnAt = this.now(); room.pgn = board.pgn();
                if (board.isGameOver()) this.finish(room, { winner: board.isCheckmate() ? (board.turn() === "w" ? "black" : "white") : null, reason: board.isCheckmate() ? "checkmate" : "draw" });
                await this.commit(room);
                return;
            }
            error("Yêu cầu không hợp lệ");
        });
    }
}
