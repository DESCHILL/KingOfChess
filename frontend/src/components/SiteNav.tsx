import { NavLink } from "react-router-dom";

const items = [
    { label: "Trang chủ", href: "/" },
    { label: "Ghép trận", href: "/game" },
    { label: "Phòng chơi", href: "/rooms" },
    { label: "Chơi với máy", href: "/computer" },
    { label: "Lịch sử", href: "/history" },
    { label: "Tài khoản", href: "/account" },
];

export const SiteNav = () => <header className="relative z-50 px-4 pt-6 flex justify-center">
    <nav aria-label="Điều hướng chính" className="flex flex-wrap justify-center items-center gap-1 rounded-2xl sm:rounded-full border border-white/15 bg-[#15131a] p-2 shadow-xl">
        <NavLink to="/" aria-label="KingOfChess" className="hidden sm:flex w-10 h-10 items-center justify-center rounded-full bg-white text-emerald-600 text-2xl mr-1">♚</NavLink>
        {items.map(item => <NavLink key={item.href} to={item.href} end className={({ isActive }) => `rounded-full px-3 sm:px-5 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition ${isActive ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>{item.label}</NavLink>)}
    </nav>
</header>;
