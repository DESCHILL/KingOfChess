import { createContext, useContext } from "react";
export type User = { id: string; username: string; isGuest: boolean };
export const AuthContext = createContext<{ user: User | null; loading: boolean; error: string; refresh: () => Promise<void>; setUser: (user: User | null) => void }>({ user: null, loading: true, error: "", refresh: async () => {}, setUser: () => {} });
export const useAuth = () => useContext(AuthContext);
export async function api<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`/api${path}`, { credentials: "same-origin", ...(body !== undefined ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Không thể kết nối máy chủ");
    return data as T;
}
