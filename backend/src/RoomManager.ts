import { randomInt } from "node:crypto";
import { Chess } from "chess.js";
import type WebSocket from "ws";
import { MoveSchema } from "./messages.js";

type Result = { winner: "white" | "black" | null; reason: string };
type Room = {
    code: string;
    white: WebSocket;
    black: WebSocket | null;
    viewers: Set<WebSocket>;
    board: Chess;
    status: "waiting" | "playing" | "finished";
    result: Result | null;
    round: number;
    restart: Set<WebSocket>;
};

export class RoomManager {
    private rooms = new Map<string, Room>();
    private memberships = new Map<WebSocket, Room>();

    has(socket: WebSocket) {
        return this.memberships.has(socket);
    }

    private send(socket: WebSocket, type: string, payload: unknown) {
        if (socket.readyState === 1) socket.send(JSON.stringify({ type, payload }));
    }

    private error(socket: WebSocket, message: string) {
        this.send(socket, "room_error", { message });
    }

    private broadcast(room: Room) {
        for (const [socket, current] of this.memberships) {
            if (current !== room) continue;
            this.send(socket, "room_state", {
                code: room.code,
                role: socket === room.white ? "white" : socket === room.black ? "black" : "spectator",
                status: room.status,
                pgn: room.board.pgn(),
                fen: room.board.fen(),
                viewers: room.viewers.size,
                players: Number(this.memberships.has(room.white)) + Number(room.black !== null && this.memberships.has(room.black)),
                result: room.result,
                round: room.round,
                restartRequested: room.restart.has(socket),
                restartPending: room.restart.size > 0,
            });
        }
    }

    leave(socket: WebSocket) {
        const room = this.memberships.get(socket);
        if (!room) return;
        this.memberships.delete(socket);
        room.viewers.delete(socket);
        room.restart.clear();
        if ((socket === room.white || socket === room.black) && room.status !== "finished") {
            room.result = { winner: room.status === "playing" ? (socket === room.white ? "black" : "white") : null, reason: "player_left" };
            room.status = "finished";
        }
        if (![...this.memberships.values()].includes(room)) this.rooms.delete(room.code);
        else this.broadcast(room);
    }

    handle(socket: WebSocket, data: unknown, busy: boolean) {
        if (typeof data !== "object" || data === null || !("type" in data) || typeof data.type !== "string" || !data.type.startsWith("room_")) return false;
        if (data.type === "room_leave") {
            this.leave(socket);
            this.send(socket, "room_left", {});
            return true;
        }
        if (data.type === "room_create" || data.type === "room_join") {
            if (busy || this.has(socket)) {
                this.error(socket, "Bạn đang ở trong một ván hoặc phòng khác. Hãy thoát trước.");
                return true;
            }
            if (data.type === "room_create") {
                const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
                let code: string;
                do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(""); } while (this.rooms.has(code));
                const room: Room = { code, white: socket, black: null, viewers: new Set(), board: new Chess(), status: "waiting", result: null, round: 1, restart: new Set() };
                this.rooms.set(code, room);
                this.memberships.set(socket, room);
                this.broadcast(room);
            } else {
                const code = "code" in data && typeof data.code === "string" ? data.code.replace(/\s/g, "").toUpperCase() : "";
                const room = this.rooms.get(code);
                if (!room) {
                    this.error(socket, "Phòng không tồn tại");
                    return true;
                }
                if (room.status === "waiting" && room.black === null) {
                    room.black = socket;
                    room.status = "playing";
                } else room.viewers.add(socket);
                this.memberships.set(socket, room);
                this.broadcast(room);
            }
            return true;
        }
        if (data.type === "room_restart") {
            const room = this.memberships.get(socket);
            if (!room || (socket !== room.white && socket !== room.black)) {
                this.error(socket, "Chỉ người chơi được yêu cầu đấu trận mới.");
                return true;
            }
            if (!("round" in data) || data.round !== room.round || room.status === "waiting") {
                this.broadcast(room);
                return true;
            }
            if ("cancel" in data && data.cancel === true) {
                room.restart.clear();
            } else {
                room.restart.add(socket);
                const bothPresent = this.memberships.get(room.white) === room && room.black !== null && this.memberships.get(room.black) === room;
                if (!bothPresent || room.restart.size === 2) {
                    if (bothPresent && room.black) {
                        [room.white, room.black] = [room.black, room.white];
                        room.status = "playing";
                    } else {
                        room.white = socket;
                        room.black = null;
                        room.status = "waiting";
                    }
                    room.board = new Chess();
                    room.result = null;
                    room.restart.clear();
                    room.round++;
                }
            }
            this.broadcast(room);
            return true;
        }
        if (data.type === "room_move") {
            const room = this.memberships.get(socket);
            if (!room || room.status !== "playing") {
                this.error(socket, "Ván cờ chưa bắt đầu hoặc đã kết thúc.");
                return true;
            }
            const mover = room.board.turn() === "w" ? room.white : room.black;
            const move = MoveSchema.safeParse("move" in data ? data.move : null);
            if (socket !== mover || !move.success) {
                this.error(socket, "Bạn không có quyền đi quân ở lượt này.");
                return true;
            }
            try {
                const { from, to, promotion } = move.data;
                room.board.move(promotion ? { from, to, promotion } : { from, to });
            } catch {
                this.error(socket, "Nước đi không hợp lệ.");
                return true;
            }
            if (room.board.isGameOver()) {
                room.status = "finished";
                room.result = {
                    winner: room.board.isCheckmate() ? (room.board.turn() === "w" ? "black" : "white") : null,
                    reason: room.board.isCheckmate() ? "checkmate" : "draw",
                };
            }
            this.broadcast(room);
            return true;
        }
        this.error(socket, "Yêu cầu phòng không hợp lệ.");
        return true;
    }
}
