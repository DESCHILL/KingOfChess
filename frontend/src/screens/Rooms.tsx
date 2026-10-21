import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Chess } from "chess.js";
import { SiteNav } from "../components/SiteNav";
import { ChessBoard } from "../components/ChessBoard";
import { RematchControls } from "../components/RematchControls";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../hooks/useAuth";

type RoomState = {
    code: string; gameId: string; revision: number; mode: "room" | "quick";
    role: "white" | "black" | "spectator"; status: "waiting" | "playing" | "finished";
    pgn: string; viewers: number; players: number; round: number; minutes: number;
    restartRequested: boolean; restartPending: boolean;
    white: { id: string; username: string }; black: { id: string; username: string } | null;
    clock: { white: number; black: number }; turn: "w" | "b";
    whiteOnline: boolean; blackOnline: boolean; reconnectSeconds: Record<string, number>;
    result: { winner: "white" | "black" | null; reason: string } | null;
};
const timeText = (value: number) => { const seconds = Math.max(0, Math.ceil(value / 1000)); return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`; };
const reasons: Record<string, string> = { checkmate: "chiếu hết", draw: "hòa theo luật", timeout: "hết thời gian", disconnect: "hết 120 giây chờ kết nối lại", player_left: "người chơi rời phòng", cancelled: "hủy phòng", restarted: "hai bên bắt đầu ván mới" };

export const Rooms = ({ quick = false }: { quick?: boolean }) => {
    const auth = useAuth();
    const socket = useSocket(Boolean(auth.user));
    const [room, setRoom] = useState<RoomState | null>(null);
    const [code, setCode] = useState("");
    const [minutes, setMinutes] = useState(10);
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);
    const [syncing, setSyncing] = useState(true);
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const pgn = room?.pgn;
    const chess = useMemo(() => { const game = new Chess(); if (pgn) game.loadPgn(pgn); return game; }, [pgn]);

    useEffect(() => {
        if (!socket) return;
        const receive = (event: MessageEvent) => {
            const message = JSON.parse(event.data);
            if (message.type === "room_clock") {
                setRoom(current => current?.code === message.payload.code ? { ...current, ...message.payload } : current);
                return;
            }
            clearTimeout(timer.current);
            setPending(false); setSyncing(false);
            if (message.type === "room_state") { setRoom(message.payload); setError(""); }
            if (message.type === "room_error") setError(message.payload.message);
            if (message.type === "room_left") { setRoom(null); setCopied(false); }
        };
        const closed = () => { clearTimeout(timer.current); setPending(false); setSyncing(true); setError("Mất kết nối. Hệ thống đang thử kết nối lại; đồng hồ của ván vẫn chạy."); };
        socket.addEventListener("message", receive);
        socket.addEventListener("close", closed);
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "room_sync" }));
        return () => { clearTimeout(timer.current); socket.removeEventListener("message", receive); socket.removeEventListener("close", closed); };
    }, [socket]);
    const send = (type: string, extra: Record<string, unknown> = {}) => {
        if (!socket || socket.readyState !== WebSocket.OPEN) { setError("Chưa kết nối máy chủ"); return; }
        setError(""); setPending(true);
        socket.send(JSON.stringify({ type, ...extra }));
        clearTimeout(timer.current);
        timer.current = setTimeout(() => { setPending(false); setError("Máy chủ chưa xác nhận. Vui lòng chờ kết nối hoặc thử lại."); }, 10000);
    };
    const result = room?.result;
    const title = room?.status === "waiting" ? (room.mode === "quick" ? "Đang tìm đối thủ" : "Đang chờ đối thủ") : room?.status === "finished" ? "Ván cờ đã kết thúc" : chess.turn() === "w" ? "Lượt quân trắng" : "Lượt quân đen";
    const role = room?.role === "white" ? "Quân trắng" : room?.role === "black" ? "Quân đen" : "Người xem";
    const locked = !socket || syncing || pending;
    return <div className="min-h-screen bg-[#0a0a0a] text-slate-200 pb-12"><SiteNav />
        <main className="max-w-6xl mx-auto px-5 pt-10">
            <p className="text-emerald-400 text-sm mb-3">KINGOFCHESS · {quick ? "GHÉP TRẬN" : "PHÒNG CHƠI"}</p>
            <h1 className="text-3xl font-bold">{quick ? "Ghép trận nhanh" : "Phòng chơi"}</h1>
            <p className="text-slate-400 mt-3 mb-6">{auth.user ? `Xin chào ${auth.user.username}. Ván đấu được lưu tự động theo từng nước đi.` : "Đăng nhập để lưu lịch sử và quay lại ván đang chơi."}</p>
            {error && <p role="alert" className="mb-5 rounded-xl bg-amber-400/10 text-amber-200 p-4">{error}</p>}
            {auth.loading ? <p>Đang kiểm tra tài khoản…</p> : !auth.user ? <Link to="/account" className="inline-block bg-emerald-400 text-black font-semibold rounded-xl px-6 py-3">Đăng nhập / Đăng ký / Chơi khách</Link> : !room ? <div className={`grid gap-6 ${quick ? "max-w-xl" : "md:grid-cols-2"}`}>
                <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
                    <h2 className="text-2xl font-semibold mb-4">{quick ? "Tìm người chơi" : "Tạo phòng mới"}</h2>
                    <p className="text-slate-400 mb-6">{quick ? "Ghép với người đang chờ có cùng thời gian thi đấu." : "Bạn cầm quân trắng. Người nhập mã đầu tiên cầm quân đen; người vào sau chỉ xem."}</p>
                    <label htmlFor="minutes" className="block mb-2 text-sm">Thời gian mỗi bên</label>
                    <select id="minutes" value={minutes} onChange={event => setMinutes(Number(event.target.value))} className="room-input mb-5">{[3, 5, 10, 15].map(value => <option key={value} value={value}>{value} phút</option>)}</select>
                    <button disabled={locked} className="room-primary" onClick={() => send(quick ? "init_game" : "room_create", { minutes })}>{pending ? "Đang xử lý…" : quick ? "Tìm đối thủ" : "Tạo phòng"}</button>
                </section>
                {!quick && <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
                    <h2 className="text-2xl font-semibold mb-4">Vào phòng bằng mã</h2>
                    <p className="text-slate-400 mb-6">Phòng đủ hai người chơi sẽ chuyển bạn vào chế độ xem trực tiếp.</p>
                    <form onSubmit={event => {
                        event.preventDefault(); const normalized = code.replace(/\s/g, "").toUpperCase(); setCode(normalized);
                        if (!normalized) setError("Vui lòng nhập mã phòng");
                        else if (!/^[A-Z0-9]{6}$/.test(normalized)) setError("Phòng không tồn tại");
                        else send("room_join", { code: normalized });
                    }}>
                        <label htmlFor="room-code" className="block mb-2 text-sm">Mã phòng</label>
                        <input id="room-code" value={code} onChange={event => { setCode(event.target.value); setError(""); }} maxLength={64} autoComplete="off" spellCheck={false} className="room-input uppercase tracking-widest" placeholder="Ví dụ: A2BC3D" />
                        <p className="text-xs text-slate-400 mt-2 mb-5">Không phân biệt chữ hoa, chữ thường.</p>
                        <button disabled={locked} className="room-primary">{pending ? "Đang xử lý…" : "Vào phòng"}</button>
                    </form>
                </section>}
                <p className="md:col-span-full text-sm text-slate-400">{!socket || syncing ? "Đang kết nối và tìm ván cũ…" : "Đã kết nối máy chủ"}. Mỗi tab có phiên đăng nhập riêng. Dùng hai tài khoản khác nhau để chơi hai bên. <a href="/account" target="_blank" rel="noopener noreferrer" className="text-emerald-400">Mở tab người chơi thứ hai →</a></p>
            </div> : <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8 items-start">
                <section className="flex flex-col items-center gap-4">
                    <div className="grid grid-cols-2 gap-3 w-full max-w-[512px]">{(["white", "black"] as const).map(side => <div key={side} className={`rounded-xl border p-4 ${room.status === "playing" && room.turn === side[0] ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}>
                        <p className="text-sm truncate">{side === "white" ? "♔" : "♚"} {room[side]?.username || "Chờ đối thủ"}</p>
                        <p className="text-3xl sm:text-4xl font-mono tabular-nums mt-2" aria-label={`Đồng hồ ${side === "white" ? "trắng" : "đen"}`}>{timeText(room.clock[side])}</p>
                        {room[side] && !(side === "white" ? room.whiteOnline : room.blackOnline) && <p className="text-xs text-amber-200 mt-2">Mất kết nối{room.status === "playing" ? ` · còn ${room.reconnectSeconds[room[side]!.id] ?? 120}s để quay lại` : ""}</p>}
                    </div>)}</div>
                    <div className="flex justify-between w-full max-w-[512px] text-sm text-slate-400"><span>{role}</span><span>{title}</span></div>
                    <ChessBoard key={`${room.gameId}-${room.role}`} board={chess.board()} chess={chess} setBoard={() => {}} socket={socket} color={room.role === "spectator" ? null : room.role} disabled={locked || room.role === "spectator" || room.status !== "playing"} onMove={move => send("room_move", { move, gameId: room.gameId, revision: room.revision })} />
                    {room.role === "spectator" && <p className="text-amber-200 text-sm">Bạn đang xem trực tiếp, không thể đi quân.</p>}
                </section>
                <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                    <p className="text-sm text-slate-400">Mã phòng · {room.minutes} phút mỗi bên</p>
                    <p data-testid="active-room-code" className="text-3xl font-mono tracking-widest text-emerald-400 mt-2">{room.code}</p>
                    <button className="room-secondary mt-4" onClick={async () => { try { await navigator.clipboard.writeText(room.code); setCopied(true); } catch { setError("Hãy chọn và sao chép mã phòng phía trên"); } }}>{copied ? "Đã sao chép" : "Sao chép mã"}</button>
                    <h2 className="text-xl font-semibold mt-6">{title}</h2><p className="text-sm text-emerald-400 mt-2">Ván {room.round} · {role} · {room.viewers} người xem</p>
                    {result && <p className="text-slate-300 mt-3">{result.winner ? `${result.winner === "white" ? "Quân trắng" : "Quân đen"} thắng` : "Không có bên thắng"} — {reasons[result.reason] || result.reason}.</p>}
                    {room.status === "waiting" && <p className="text-slate-400 text-sm mt-3">{room.mode === "quick" ? "Đang đợi người chơi có cùng thời gian thi đấu." : "Gửi mã cho người chơi thứ hai để bắt đầu."}</p>}
                    {room.role !== "spectator" && room.status !== "waiting" && <RematchControls requested={room.restartRequested} pending={room.restartPending} alone={room.players < 2} disabled={locked} onRequest={() => send("room_restart", { round: room.round })} onCancel={() => send("room_restart", { round: room.round, cancel: true })} />}
                    <button disabled={pending || !socket} className="room-secondary mt-5" onClick={() => send("room_leave")}>{room.status === "playing" && room.role !== "spectator" ? "Đầu hàng và thoát phòng" : "Thoát phòng"}</button>
                    <p className="text-xs text-slate-400 mt-3">Tải lại trang hoặc mất mạng: có 120 giây quay lại, đồng hồ vẫn chạy. Nút thoát là rời ván ngay.</p>
                    <Link to="/history" className="inline-block mt-4 text-emerald-400 text-sm">Lịch sử và xem lại ván →</Link>
                    <h3 className="text-sm font-semibold mt-5 mb-2">Nước đi đã lưu</h3>
                    <p className="max-h-36 overflow-auto font-mono text-sm text-slate-400 leading-7 break-words">{chess.history().map((move, i) => `${i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}${move}`).join(" ") || "Chưa có nước đi"}</p>
                </aside>
            </div>}
        </main>
    </div>;
};
