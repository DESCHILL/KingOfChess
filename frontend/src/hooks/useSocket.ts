import { useEffect, useState } from "react";
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080";
const MAX_RETRY_DELAY_MS = 10000;
export const useSocket = () => {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    useEffect(() => {
        let current: WebSocket | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let attempt = 0;
        let stopped = false;
        const connect = () => {
            const ws = new WebSocket(WS_URL);
            current = ws;
            ws.onopen = () => {
                if (stopped) { ws.close(); return; }
                attempt = 0;
                setSocket(ws);
            };
            ws.onclose = () => {
                if (stopped)
                    return;
                setSocket(null);
                const delay = Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
                attempt++;
                retryTimer = setTimeout(connect, delay);
            };
        };
        connect();
        return () => {
            stopped = true;
            clearTimeout(retryTimer);
            current?.close();
        };
    }, []);
    return socket;
};
