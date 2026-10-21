import type { Square } from "chess.js";
import type { HeroPiece } from "../hooks/useReplay";
function toCoords(square: Square) {
    const col = square.charCodeAt(0) - 97;
    const row = 8 - Number(square[1]);
    return { col, row };
}
export const HeroBoard = ({ pieces, lastMove }: {
    pieces: HeroPiece[];
    lastMove: {
        from: Square;
        to: Square;
    } | null;
}) => {
    return (<div className="relative aspect-square w-full overflow-hidden rounded-md shadow-2xl [view-transition-name:board]">

            
            <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
                {Array.from({ length: 64 }, (_, i) => {
            const row = Math.floor(i / 8);
            const col = i % 8;
            const isLight = (row + col) % 2 === 0;
            return <div key={i} className={isLight ? "bg-[#ebecd0]" : "bg-[#739552]"}/>;
        })}
            </div>

            
            {lastMove && [lastMove.from, lastMove.to].map((sq) => {
            const { col, row } = toCoords(sq);
            return (<div key={sq} className="absolute top-0 left-0 w-[12.5%] h-[12.5%] bg-yellow-300/40" style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}/>);
        })}

            
            {pieces.map((piece) => {
            const { col, row } = toCoords(piece.square);
            return (<img key={piece.id} src={`/${piece.color}${piece.type}.svg`} alt="" className={`absolute top-0 left-0 w-[12.5%] h-[12.5%] p-[1.2%] transition-[transform,opacity] duration-500 ease-in-out ${piece.captured ? "opacity-0 z-0" : "z-10"}`} style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}/>);
        })}
        </div>);
};
