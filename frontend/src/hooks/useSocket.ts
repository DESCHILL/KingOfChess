import { useEffect, useState } from "react";
import { tabSession } from "./tabSession";
const WS_URL = import.meta.env.VITE_WS_URL || `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`;
const MAX_RETRY_DELAY_MS = 10000;
export const useSocket = (enabled = true) => {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    useEffect(() => {
        if (!enabled) return;
        let current: WebSocket | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let attempt = 0;
        let stopped = false;
        const connect = () => {
            const ws = new WebSocket(WS_URL, ["kingofchess", `tab.${tabSession}`]);
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
    }, [enabled]);
    return enabled ? socket : null;
};
