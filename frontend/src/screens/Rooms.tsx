import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { SiteNav } from "../components/SiteNav";
import { ChessBoard } from "../components/ChessBoard";
import { useSocket } from "../hooks/useSocket";
import { RematchControls } from "../components/RematchControls";

type RoomState = {
    code: string;
    role: "white" | "black" | "spectator";
    status: "waiting" | "playing" | "finished";
    pgn: string;
    viewers: number;
    players: number;
    round: number;
    restartRequested: boolean;
    restartPending: boolean;
    result: { winner: "white" | "black" | null; reason: string } | null;
};

export const Rooms = () => {
    const socket = useSocket();
    const [room, setRoom] = useState<RoomState | null>(null);
    const [chess, setChess] = useState(() => new Chess());
    const [board, setBoard] = useState(() => chess.board());
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);
    const [copied, setCopied] = useState(false);
    const requestTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        if (!socket) return;
        const onMessage = (event: MessageEvent) => {
            const message = JSON.parse(event.data);
            if (["room_state", "room_error", "room_left"].includes(message.type)) clearTimeout(requestTimer.current);
            if (message.type === "room_state") {
                const state = message.payload as RoomState;
                const next = new Chess();
                if (state.pgn) next.loadPgn(state.pgn);
                setRoom(state);
                setChess(next);
                setBoard(next.board());
                setError("");
                setPending(false);
            } else if (message.type === "room_error") {
                setError(message.payload.message);
                setPending(false);
            } else if (message.type === "room_left") {
                setRoom(null);
                setPending(false);
                setCopied(false);
            }
        };
        const onClose = () => {
            clearTimeout(requestTimer.current);
            setRoom(null);
            setPending(false);
            setCopied(false);
            setError("Kết nối đã mất. Nếu đang thi đấu, bạn đã rời ván. Khi kết nối lại, bạn có thể nhập mã để xem hoặc tạo phòng mới.");
        };
        socket.addEventListener("message", onMessage);
        socket.addEventListener("close", onClose);
        return () => {
            clearTimeout(requestTimer.current);
            socket.removeEventListener("message", onMessage);
            socket.removeEventListener("close", onClose);
        };
    }, [socket]);

    const send = (type: string, extra: Record<string, unknown> = {}) => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            setError("Chưa kết nối được tới máy chủ. Vui lòng thử lại.");
            return;
        }
        setError("");
        setPending(true);
        socket.send(JSON.stringify({ type, ...extra }));
        clearTimeout(requestTimer.current);
        requestTimer.current = setTimeout(() => {
            setPending(false);
            setError("Máy chủ chưa phản hồi. Vui lòng kiểm tra kết nối rồi thử lại.");
        }, 10000);
    };
    const joinRoom = () => {
        const normalized = code.replace(/\s/g, "").toUpperCase();
        setCode(normalized);
        if (!normalized) {
            setError("Vui lòng nhập mã phòng");
            return;
        }
        if (!/^[A-Z0-9]{6}$/.test(normalized)) {
            setError("Phòng không tồn tại");
            return;
        }
        send("room_join", { code: normalized });
    };
    const roleName = room?.role === "white" ? "Quân trắng" : room?.role === "black" ? "Quân đen" : "Người xem";
    const result = room?.result;
    const statusText = room?.status === "waiting" ? "Đang chờ đối thủ" : room?.status === "finished" ? "Ván cờ đã kết thúc" : chess.turn() === "w" ? "Lượt quân trắng" : "Lượt quân đen";
    const resultText = result ? (result.winner ? `${result.winner === "white" ? "Quân trắng" : "Quân đen"} thắng${result.reason === "player_left" ? " do đối thủ rời phòng" : " do chiếu hết"}.` : result.reason === "player_left" ? "Phòng đã đóng do người chơi rời phòng." : "Ván cờ hòa.") : "";

    return <div className="min-h-screen bg-[#0a0a0a] text-slate-200 pb-12">
        <SiteNav />
        <main className="max-w-6xl mx-auto px-5 pt-12">
            <div className="mb-8">
                <p className="text-emerald-400 text-sm tracking-widest uppercase mb-3">KingOfChess · Room</p>
                <h1 className="text-3xl sm:text-4xl font-bold">Phòng chơi</h1>
                <p className="text-slate-400 mt-3">Chia sẻ mã phòng, cùng bạn bè đấu trí trên bàn cờ.</p>
            </div>
            {error && <div role="alert" className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">{error}</div>}
            {!room ? <div className="grid md:grid-cols-2 gap-6">
                <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-7 sm:p-9">
                    <span className="text-4xl" aria-hidden="true">♔</span>
                    <h2 className="text-2xl font-semibold mt-5">Tạo phòng mới</h2>
                    <p className="text-slate-400 mt-3 mb-8 leading-relaxed">Bạn cầm quân trắng. Người đầu tiên nhập mã phòng sẽ cầm quân đen và ván đấu bắt đầu ngay.</p>
                    <button className="room-primary" disabled={!socket || pending} onClick={() => send("room_create")}>{pending ? "Đang xử lý…" : "Tạo phòng"}</button>
                </section>
                <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-7 sm:p-9">
                    <span className="text-4xl" aria-hidden="true">♟</span>
                    <h2 className="text-2xl font-semibold mt-5">Vào phòng bằng mã</h2>
                    <p className="text-slate-400 mt-3 mb-6 leading-relaxed">Nếu đã đủ hai người chơi, bạn sẽ vào phòng với vai trò người xem.</p>
                    <form onSubmit={event => { event.preventDefault(); joinRoom(); }}>
                        <label htmlFor="room-code" className="block text-sm mb-2">Mã phòng</label>
                        <input id="room-code" aria-describedby="room-code-help" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={64} value={code} onChange={event => { setCode(event.target.value); setError(""); }} placeholder="Ví dụ: A2BC3D" className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-3 tracking-widest uppercase focus:outline-none focus:border-emerald-400" />
                        <p id="room-code-help" className="mt-2 text-xs text-slate-400">Nhập hoặc dán mã 6 ký tự. Không phân biệt chữ hoa, chữ thường.</p>
                        <button className="room-primary mt-4" disabled={!socket || pending}>{pending ? "Đang xử lý…" : "Vào phòng"}</button>
                    </form>
                </section>
                <p className="md:col-span-2 text-sm text-slate-500">{socket ? "Đã kết nối máy chủ" : "Đang kết nối máy chủ…"} · Người xem không thể đi quân. Rời phòng khi đang thi đấu được tính là thua.</p>
            </div> : <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8 items-start">
                <section className="flex flex-col items-center gap-5">
                    <div className="flex justify-between w-full max-w-[512px] text-sm text-slate-400"><span>{roleName}</span><span>{statusText}</span></div>
                    <ChessBoard key={`${room.code}-${room.round}`} board={board} chess={chess} setBoard={setBoard} socket={socket} color={room.role === "spectator" ? null : room.role} disabled={!socket || pending || room.role === "spectator" || room.status !== "playing"} onMove={move => send("room_move", { move })} />
                    {room.role === "spectator" && <p className="text-amber-200 text-sm">Phòng đã đủ người chơi. Bạn đang xem trực tiếp.</p>}
                </section>
                <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                    <p className="text-sm text-slate-400">Mã phòng</p>
                    <p className="text-3xl font-mono font-bold tracking-[0.18em] mt-2 text-emerald-400" data-testid="active-room-code">{room.code}</p>
                    <button className="room-secondary mt-4" onClick={async () => { try { await navigator.clipboard.writeText(room.code); setCopied(true); } catch { setError("Không sao chép tự động được. Bạn có thể chọn và sao chép mã phòng phía trên."); } }}>{copied ? "Đã sao chép" : "Sao chép mã"}</button>
                    <div className="border-t border-white/10 my-6" />
                    <h2 className="text-xl font-semibold">{statusText}</h2>
                    <p className="mt-2 text-sm text-emerald-400">Ván {room.round}</p>
                    <p className="text-slate-400 text-sm mt-3">{room.status === "waiting" ? "Gửi mã cho bạn bè. Người vào đầu tiên sẽ được ghép trận với bạn." : resultText || "Nước đi được cập nhật trực tiếp cho tất cả người trong phòng."}</p>
                    <dl className="text-sm mt-6 space-y-3"><div className="flex justify-between"><dt>Vai trò của bạn</dt><dd className="text-emerald-400">{roleName}</dd></div><div className="flex justify-between"><dt>Người chơi còn trong phòng</dt><dd>{room.players}/2</dd></div><div className="flex justify-between"><dt>Người xem</dt><dd>{room.viewers}</dd></div></dl>
                    {room.role !== "spectator" && room.status !== "waiting" && <RematchControls requested={room.restartRequested} pending={room.restartPending} alone={room.players < 2} disabled={!socket || pending} onRequest={() => send("room_restart", { round: room.round })} onCancel={() => send("room_restart", { round: room.round, cancel: true })} />}
                    {room.role === "spectator" && room.restartPending && <p className="text-sm text-amber-200 mt-5">Hai người chơi đang xác nhận đấu trận mới.</p>}
                    <button className="room-secondary mt-7" disabled={pending} onClick={() => send("room_leave")}>Thoát phòng</button>
                    <p className="text-xs text-slate-500 mt-3">Rời hoặc tải lại trang khi đang thi đấu sẽ kết thúc ván. Người xem không thay thế người chơi đã rời.</p>
                    <h3 className="text-sm font-semibold mt-7 mb-3">Nước đi</h3>
                    <div className="max-h-40 overflow-auto text-sm text-slate-400 font-mono leading-7 break-words">{chess.history().map((move, index) => `${index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ""}${move}`).join(" ") || "Chưa có nước đi"}</div>
                </aside>
            </div>}
        </main>
    </div>;
};
