import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Chess } from "chess.js";
import { api, useAuth } from "../hooks/useAuth";
import { ChessBoard } from "../components/ChessBoard";
import { SiteNav } from "../components/SiteNav";

type Entry = { id: string; code: string; status: string; result: string; createdAt: string; whiteName: string; blackName: string | null };
type Game = { id: string; code: string; white: string; black: string; pgn: string; status: string; minutes: number; result: { winner: string | null; reason: string } | null };
const statuses: Record<string, string> = { waiting: "Chờ đối thủ", playing: "Đang đấu", finished: "Đã kết thúc" };
export const History = () => {
    const { user } = useAuth();
    const [games, setGames] = useState<Entry[]>([]);
    const [selected, setSelected] = useState<Game | null>(null);
    const [step, setStep] = useState(0);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (!user) return;
        let active = true;
        api<{ games: Entry[] }>("/games").then(data => { if (active) setGames(data.games); }).catch(reason => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [user]);
    const moves = useMemo(() => { const game = new Chess(); if (selected?.pgn) game.loadPgn(selected.pgn); return game.history(); }, [selected]);
    const board = useMemo(() => { const game = new Chess(); for (const move of moves.slice(0, step)) game.move(move); return game; }, [moves, step]);
    return <div className="min-h-screen bg-[#0a0a0a] text-slate-200 pb-12"><SiteNav /><main className="max-w-6xl mx-auto px-5 pt-10">
        <h1 className="text-3xl font-bold">Lịch sử ván đấu</h1><p className="text-slate-400 mt-3 mb-7">100 ván gần nhất của bạn. Chọn một ván để xem lại từng nước đi.</p>
        {error && <p role="alert" className="text-amber-200 mb-5">{error}</p>}
        {!user ? <Link to="/account" className="text-emerald-400">Đăng nhập để xem lịch sử →</Link> : <div className="grid lg:grid-cols-2 gap-8">
            <section className="space-y-3 max-h-[720px] overflow-y-auto">{loading ? <p>Đang tải lịch sử…</p> : !games.length ? <p>Chưa có ván nào. <Link className="text-emerald-400" to="/rooms">Tạo phòng chơi</Link></p> : games.map(game => <button key={game.id} className={`w-full text-left rounded-xl border p-4 ${selected?.id === game.id ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-white/5"}`} onClick={async () => {
                setError(""); try { const data = await api<{ game: Game }>(`/games/${game.id}`); setSelected(data.game); setStep(0); } catch (reason) { setError(reason instanceof Error ? reason.message : "Không tải được ván"); }
            }}><span className="block font-semibold">{game.whiteName} — {game.blackName || "Chờ đối thủ"}</span><span className="text-sm text-slate-400">{game.code} · {statuses[game.status]} · {new Date(game.createdAt).toLocaleString("vi-VN")}</span></button>)}</section>
            {selected && <section className="space-y-4"><h2 className="text-xl">{selected.white} — {selected.black}</h2>
                <p className="text-sm text-slate-400">{statuses[selected.status]} · {selected.minutes} phút · {selected.result?.winner ? `${selected.result.winner === "white" ? "Trắng" : "Đen"} thắng` : selected.result ? "Không có bên thắng" : "Chưa có kết quả"}</p>
                <ChessBoard key={selected.id} board={board.board()} chess={board} socket={null} setBoard={() => {}} color="white" disabled />
                <div className="grid grid-cols-4 gap-2"><button className="room-secondary" disabled={step === 0} onClick={() => setStep(0)}>Đầu</button><button className="room-secondary" disabled={step === 0} onClick={() => setStep(value => value - 1)}>Trước</button><button className="room-secondary" disabled={step === moves.length} onClick={() => setStep(value => value + 1)}>Tiếp</button><button className="room-secondary" disabled={step === moves.length} onClick={() => setStep(moves.length)}>Cuối</button></div>
                <input aria-label="Vị trí nước đi" type="range" min={0} max={moves.length} value={step} onChange={event => setStep(Number(event.target.value))} className="w-full accent-emerald-400" />
                <p className="text-sm text-slate-400">Nước {step}/{moves.length}{step > 0 ? ` · ${moves[step - 1]}` : " · Vị trí ban đầu"}</p>
                <p className="text-sm font-mono text-slate-400 break-words">{moves.join(" ") || "Chưa có nước đi"}</p>
            </section>}
        </div>}
    </main></div>;
};
