import { useState } from "react";
import { Link } from "react-router-dom";
import { Chess } from "chess.js";
import { ChessBoard } from "../components/ChessBoard";
import { SiteNav } from "../components/SiteNav";

export const Computer = () => {
    const [chess] = useState(() => new Chess());
    const [board, setBoard] = useState(() => chess.board());
    const [color, setColor] = useState<"white" | "black">("white");
    const [level, setLevel] = useState("easy");
    return <div className="min-h-screen bg-[#0a0a0a] text-slate-200 pb-12">
        <SiteNav />
        <main className="max-w-6xl mx-auto px-5 pt-12">
            <p className="text-emerald-400 text-sm uppercase tracking-widest mb-3">KingOfChess · Computer</p>
            <h1 className="text-3xl sm:text-4xl font-bold">Chơi với máy</h1>
            <p className="text-slate-400 mt-3 mb-9">Không gian luyện tập theo tốc độ của riêng bạn.</p>
            <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8 items-start">
                <div className="flex justify-center"><ChessBoard board={board} chess={chess} setBoard={setBoard} socket={null} color={color} disabled /></div>
                <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                    <span className="inline-block rounded-full bg-amber-400/10 text-amber-200 text-xs px-3 py-1">Sắp ra mắt</span>
                    <h2 className="text-xl font-semibold mt-5">Thiết lập ván luyện tập</h2>
                    <fieldset className="mt-6"><legend className="text-sm text-slate-400 mb-3">Bạn muốn cầm quân nào?</legend><div className="grid grid-cols-2 gap-3">{(["white", "black"] as const).map(side => <button key={side} aria-pressed={color === side} onClick={() => setColor(side)} className={`rounded-xl border py-3 ${color === side ? "border-emerald-400 bg-emerald-400/10 text-emerald-300" : "border-white/15"}`}>{side === "white" ? "♔ Trắng" : "♚ Đen"}</button>)}</div></fieldset>
                    <label htmlFor="computer-level" className="block mt-6 text-sm text-slate-400 mb-3">Độ khó dự kiến</label>
                    <select id="computer-level" value={level} onChange={event => setLevel(event.target.value)} className="w-full bg-[#171717] border border-white/20 rounded-xl p-3"><option value="easy">Dễ · Làm quen</option><option value="medium">Vừa · Luyện tập</option><option value="hard">Khó · Thử thách</option></select>
                    <button disabled className="room-primary mt-7">Chưa thể bắt đầu</button>
                    <button disabled className="room-secondary mt-3">Đấu trận mới</button>
                    <p className="text-sm text-slate-400 mt-4 leading-relaxed">Đây là giao diện xem trước. Đối thủ máy chưa được tích hợp nên bàn cờ hiện chưa thể chơi.</p>
                    <Link to="/rooms" className="block text-center text-emerald-400 mt-6 hover:underline">Chơi với bạn bè trong phòng →</Link>
                </section>
            </div>
        </main>
    </div>;
};
