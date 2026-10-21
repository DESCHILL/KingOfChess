import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, AuthContext, type User } from "../hooks/useAuth";
export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const refresh = useCallback(async () => {
        try { const result = await api<{ user: User | null }>("/me"); setUser(result.user); setError(""); }
        catch { setError("Chưa kết nối được máy chủ. Hãy kiểm tra backend rồi thử lại."); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { void refresh(); }, [refresh]);
    return <AuthContext.Provider value={{ user, loading, error, refresh, setUser }}>{children}</AuthContext.Provider>;
};
