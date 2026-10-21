import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SiteNav } from "../components/SiteNav";
import { api, useAuth, type User } from "../hooks/useAuth";

export const Account = () => {
    const auth = useAuth();
    const navigate = useNavigate();
    const [mode, setMode] = useState<"login" | "register">("login");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const submit = async (kind: "login" | "register" | "guest") => {
        setBusy(true); setError("");
        try { const data = await api<{ user: User }>(`/auth/${kind}`, { username, password }); auth.setUser(data.user); setPassword(""); navigate("/rooms"); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể đăng nhập"); }
        finally { setBusy(false); }
    };
    return <div className="min-h-screen bg-[#0a0a0a] text-slate-200 pb-12"><SiteNav /><main className="max-w-lg mx-auto px-5 py-12">
        <p className="text-emerald-400 text-sm mb-3">KINGOFCHESS · TÀI KHOẢN</p>
        <h1 className="text-3xl font-bold mb-6">{auth.user ? "Tài khoản của bạn" : mode === "login" ? "Chào mừng trở lại" : "Tạo tài khoản"}</h1>
        {(error || auth.error) && <p role="alert" className="bg-amber-500/10 text-amber-200 rounded-xl p-4 mb-5">{error || auth.error}</p>}
        {auth.loading ? <p>Đang kiểm tra đăng nhập…</p> : auth.user ? <section className="border border-white/10 rounded-2xl p-6 space-y-5">
            <p className="text-xl font-semibold">{auth.user.username}</p><p className="text-slate-400">{auth.user.isGuest ? "Bạn đang chơi với tài khoản khách. Muốn giữ lịch sử lâu dài và đăng nhập trên máy khác, hãy tạo tài khoản riêng." : "Lịch sử ván đấu được lưu theo tài khoản của bạn."}</p>
            <Link to="/history" className="block text-emerald-400">Xem lịch sử ván đấu →</Link>
            <p className="text-sm text-slate-400">Đăng xuất khi đang đấu sẽ ngắt kết nối. Đăng nhập lại trong 120 giây để tiếp tục.</p>
            <button className="room-secondary" disabled={busy} onClick={async () => { setBusy(true); try { await api("/auth/logout", {}); auth.setUser(null); } catch { setError("Chưa đăng xuất được, vui lòng thử lại"); } finally { setBusy(false); } }}>Đăng xuất</button>
        </section> : <section className="border border-white/10 rounded-2xl p-6">
            <div className="flex gap-3 mb-6">{(["login", "register"] as const).map(value => <button key={value} onClick={() => { setMode(value); setError(""); }} className={`px-4 py-2 rounded-full ${mode === value ? "bg-emerald-400 text-black" : "bg-white/5"}`}>{value === "login" ? "Đăng nhập" : "Đăng ký"}</button>)}</div>
            <form onSubmit={event => { event.preventDefault(); void submit(mode); }} className="space-y-4">
                <label className="block">Tên đăng nhập<input required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} className="room-input mt-2" /></label>
                <label className="block">Mật khẩu<input required type="password" minLength={8} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} className="room-input mt-2" /></label>
                <p className="text-xs text-slate-400">Tên gồm 3–24 chữ, số hoặc dấu _. Mật khẩu tối thiểu 8 ký tự.</p>
                <button disabled={busy} className="room-primary">{busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</button>
            </form>
            <button disabled={busy} className="room-secondary mt-4" onClick={() => void submit("guest")}>Chơi thử với tài khoản khách</button>
            <p className="text-sm text-slate-400 mt-5">Mỗi tab đăng nhập độc lập. Mở tab mới và đăng nhập tài khoản khác để demo hai người.</p>
        </section>}
        <a href="/account" target="_blank" rel="noopener noreferrer" className="block mt-5 text-emerald-400">Mở tab demo người chơi thứ hai →</a>
    </main></div>;
};
