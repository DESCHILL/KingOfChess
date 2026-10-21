import { useState } from "react";
import type { Color, PieceSymbol, Square } from "chess.js";
import { Chess } from "chess.js";
const CHECK_GLOW = "radial-gradient(circle closest-side, #ff2020 0%, #ef4444 50%, rgba(239,68,68,0.8) 80%, rgba(239,68,68,0.45) 100%)";
export const ChessBoard = ({ board, socket, chess, setBoard, color, disabled, onMove }: {
    board: ({
        square: Square;
        type: PieceSymbol;
        color: Color;
    } | null)[][];
    socket: WebSocket | null;
    chess: Chess;
    setBoard: React.Dispatch<React.SetStateAction<({
        square: Square;
        type: PieceSymbol;
        color: Color;
    } | null)[][]>>;
    color: "white" | "black" | null;
    disabled: boolean;
    onMove?: (move: { from: Square; to: Square; promotion?: string }) => void;
}) => {
    const [from, setFrom] = useState<Square | null>(null);
    const [legalMoves, setLegalMoves] = useState<string[]>([]);
    const myColor = color === "white" ? "w" : "b";
    const isBlack = color === "black";
    const displayBoard = isBlack ? [...board].reverse().map(row => [...row].reverse()) : board;
    const lastMove = chess.history({ verbose: true }).at(-1);
    const checkedKingSquare = chess.inCheck()
        ? board.flat().find(p => p?.type === "k" && p.color === chess.turn())?.square
        : undefined;
    return (<div className="w-full max-w-[512px] [view-transition-name:board]">
            {displayBoard.map((row, i) => {
            return <div key={i} className="flex">
                    {row.map((square, j) => {
                    const fileIndex = isBlack ? 7 - j : j;
                    const rankIndex = isBlack ? i + 1 : 8 - i;
                    const squareRepresentation = (String.fromCharCode(97 + fileIndex) + "" + rankIndex) as Square;
                    const isSelected = from === squareRepresentation;
                    const isLastMove = lastMove?.from === squareRepresentation || lastMove?.to === squareRepresentation;
                    const isInCheck = checkedKingSquare === squareRepresentation;
                    return (<div role="button" aria-label={squareRepresentation} aria-disabled={disabled} onClick={() => {
                            if (disabled || (!onMove && (!socket || socket.readyState !== WebSocket.OPEN)))
                                return;
                            if (chess.turn() !== myColor)
                                return;
                            if (square?.color === myColor) {
                                if (from === squareRepresentation) {
                                    setFrom(null);
                                    setLegalMoves([]);
                                    return;
                                }
                                setFrom(squareRepresentation);
                                const moves = chess.moves({ square: squareRepresentation, verbose: true });
                                setLegalMoves(moves.map(m => m.to));
                                return;
                            }
                            if (!from)
                                return;
                            if (!legalMoves.includes(squareRepresentation)) {
                                setFrom(null);
                                setLegalMoves([]);
                                return;
                            }
                            const piece = chess.get(from);
                            const isPromotion = piece?.type === "p" &&
                                (squareRepresentation[1] === "8" || squareRepresentation[1] === "1");
                            const move = isPromotion
                                ? { from, to: squareRepresentation, promotion: "q" }
                                : { from, to: squareRepresentation };
                            if (onMove) {
                                onMove(move);
                                setFrom(null);
                                setLegalMoves([]);
                                return;
                            }
                            try {
                                chess.move(move);
                            }
                            catch (e) {
                                console.log("Invalid move attempted locally", e);
                                return;
                            }
                            setBoard(chess.board());
                            socket?.send(JSON.stringify({ type: "move", move }));
                            setFrom(null);
                            setLegalMoves([]);
                        }} key={j} className={`w-[12.5%] aspect-square relative ${(i + j) % 2 === 0 ? 'bg-[#ebecd0]' : 'bg-[#739552]'}`} style={isInCheck ? { backgroundImage: CHECK_GLOW } : undefined}>
                                
                                <div className={`w-full h-full flex items-center justify-center ${isSelected ? "bg-yellow-300/70" : isLastMove ? "bg-yellow-300/40" : ""}`}>
                                    {square ? (<img className="w-[75%] h-[75%]" src={`/${square.color}${square.type}.svg`} alt={`${square.color} ${square.type}`}/>) : null}
                                </div>

                                
                                
                                {legalMoves.includes(squareRepresentation) && (<div className="absolute top-0 left-0 w-full h-full flex justify-center items-center pointer-events-none">
                                        <div className="w-[25%] h-[25%] bg-slate-800 rounded-full opacity-50"></div>
                                    </div>)}
                            </div>);
                })}
                </div>;
        })}
        </div>);
};
