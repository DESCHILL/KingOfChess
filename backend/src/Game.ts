import type { WebSocket } from "ws";
import { Chess } from "chess.js";
import { GAME_OVER, INIT_GAME, MOVE, type GameOverReason, type Move } from "./messages.js";
export class Game {
    public player1: WebSocket;
    public player2: WebSocket;
    public board: Chess;
    public round = 1;
    private restart = new Set<WebSocket>();
    constructor(player1: WebSocket, player2: WebSocket) {
        this.player1 = player1;
        this.player2 = player2;
        this.board = new Chess();
        this.start();
    }
    private start() {
        this.player1.send(JSON.stringify({
            type: INIT_GAME,
            payload: { color: "white", round: this.round }
        }));
        this.player2.send(JSON.stringify({
            type: INIT_GAME,
            payload: { color: "black", round: this.round }
        }));
    }
    requestRestart(socket: WebSocket, round: number | undefined, cancel: boolean | undefined) {
        if (round !== this.round || (socket !== this.player1 && socket !== this.player2)) return;
        if (cancel) this.restart.clear();
        else this.restart.add(socket);
        if (this.restart.size === 2) {
            [this.player1, this.player2] = [this.player2, this.player1];
            this.board = new Chess();
            this.restart.clear();
            this.round++;
            this.start();
            return;
        }
        for (const player of [this.player1, this.player2]) {
            player.send(JSON.stringify({ type: "restart_state", payload: { requested: this.restart.has(player), pending: this.restart.size > 0 } }));
        }
    }
    makeMove(socket: WebSocket, move: Move) {
        if (this.board.isGameOver()) return;
        const whiteToMove = this.board.turn() === "w";
        const mover = whiteToMove ? this.player1 : this.player2;
        if (socket !== mover)
            return;
        const { from, to, promotion } = move;
        try {
            this.board.move(promotion ? { from, to, promotion } : { from, to });
        }
        catch {
            return;
        }
        const opponent = whiteToMove ? this.player2 : this.player1;
        opponent.send(JSON.stringify({ type: MOVE, payload: move }));
        if (this.board.isGameOver()) {
            const result = JSON.stringify({ type: GAME_OVER, payload: this.getResult() });
            this.player1.send(result);
            this.player2.send(result);
        }
    }
    private getResult(): {
        winner: "white" | "black" | null;
        reason: GameOverReason;
    } {
        if (this.board.isCheckmate()) {
            return { winner: this.board.turn() === "w" ? "black" : "white", reason: "checkmate" };
        }
        if (this.board.isStalemate())
            return { winner: null, reason: "stalemate" };
        if (this.board.isThreefoldRepetition())
            return { winner: null, reason: "repetition" };
        if (this.board.isInsufficientMaterial())
            return { winner: null, reason: "insufficient_material" };
        return { winner: null, reason: "fifty_moves" };
    }
}
