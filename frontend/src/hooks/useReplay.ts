import { useEffect, useState } from "react";
import { Chess, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import { FAMOUS_GAME } from "../data/famousGame";
export type HeroPiece = {
    id: string;
    type: PieceSymbol;
    color: Color;
    square: Square;
    captured: boolean;
};
function startingPieces(): HeroPiece[] {
    const pieces: HeroPiece[] = [];
    for (const row of new Chess().board()) {
        for (const cell of row) {
            if (cell) {
                pieces.push({ id: cell.square, type: cell.type, color: cell.color, square: cell.square, captured: false });
            }
        }
    }
    return pieces;
}
function applyMove(pieces: HeroPiece[], move: Move): HeroPiece[] {
    const rank = move.from[1];
    const capturedSquare = move.flags.includes("e") ? `${move.to[0]}${rank}` : move.to;
    const rookMove = move.flags.includes("k") ? { from: `h${rank}`, to: `f${rank}` } :
        move.flags.includes("q") ? { from: `a${rank}`, to: `d${rank}` } :
            null;
    return pieces.map((p) => {
        if (p.captured)
            return p;
        if (move.captured && p.square === capturedSquare)
            return { ...p, captured: true };
        if (p.square === move.from)
            return { ...p, square: move.to, type: move.promotion ?? p.type };
        if (rookMove && p.square === rookMove.from)
            return { ...p, square: rookMove.to as Square };
        return p;
    });
}
function formatMove(ply: number, san: string) {
    const number = Math.floor(ply / 2) + 1;
    return ply % 2 === 0 ? `${number}. ${san}` : `${number}... ${san}`;
}
const START_DELAY_MS = 1000;
const MOVE_DELAY_MS = 1100;
const END_PAUSE_MS = 4000;
export const useReplay = () => {
    const [lastMove, setLastMove] = useState<{
        from: Square;
        to: Square;
    } | null>(null);
    const [moveText, setMoveText] = useState("");
    const [pieces, setPieces] = useState(startingPieces);
    useEffect(() => {
        const chess = new Chess();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            let still = startingPieces();
            let move: Move | null = null;
            for (const san of FAMOUS_GAME.moves.slice(0, FAMOUS_GAME.keyMoment)) {
                move = chess.move(san);
                still = applyMove(still, move);
            }
            setPieces(still);
            if (move) {
                setLastMove({ from: move.from, to: move.to });
                setMoveText(formatMove(FAMOUS_GAME.keyMoment - 1, move.san));
            }
            return;
        }
        let ply = 0;
        let timer: ReturnType<typeof setTimeout>;
        const restart = () => {
            chess.reset();
            ply = 0;
            setPieces(startingPieces());
            setLastMove(null);
            setMoveText("");
            timer = setTimeout(step, START_DELAY_MS);
        };
        const step = () => {
            if (ply >= FAMOUS_GAME.moves.length) {
                timer = setTimeout(restart, END_PAUSE_MS);
                return;
            }
            const san = FAMOUS_GAME.moves[ply];
            let move: Move;
            try {
                move = chess.move(san);
            }
            catch {
                console.error(`Replay stopped: "${san}" isn't legal at half-move ${ply}`);
                return;
            }
            setPieces((prev) => applyMove(prev, move));
            setLastMove({ from: move.from, to: move.to });
            setMoveText(formatMove(ply, move.san));
            ply++;
            timer = setTimeout(step, MOVE_DELAY_MS);
        };
        const onVisibilityChange = () => {
            clearTimeout(timer);
            if (document.visibilityState === "visible") {
                timer = setTimeout(step, MOVE_DELAY_MS);
            }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        timer = setTimeout(step, START_DELAY_MS);
        return () => {
            clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, []);
    return { pieces, lastMove, moveText };
};
