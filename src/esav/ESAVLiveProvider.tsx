import { useSetAtom, useStore } from "jotai";
import { useEffect, useRef, type PropsWithChildren } from "react";
import { addLogEntryAtom, documentsAtom, queryStateFamily, websocketAtom, websocketStatusAtom } from './atoms';
import type { QueryDeltaMessage } from "./types";

export function ESAVLiveProvider({
  children,
  url,
}: PropsWithChildren<{ url: string }>) {
  const store = useStore();
  const setWebsocket = useSetAtom(websocketAtom);
  const setWebsocketStatus = useSetAtom(websocketStatusAtom);
  const addLog = useSetAtom(addLogEntryAtom);

  const reconnectTimer = useRef<number | null>(null);

  const isUnmounting = useRef(false);

  useEffect(() => {
    let reconnectAttempts = 0;
    const connect = () => {
      if (isUnmounting.current) return;

      console.log(`[ESAV] Connecting (Attempt ${reconnectAttempts + 1})...`);
      setWebsocketStatus("connecting");
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("[ESAV] WebSocket connection opened");
        setWebsocketStatus("open");
        setWebsocket(ws);
        reconnectAttempts = 0;
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "query-delta") {
            addLog({ type: 'incoming', payload: message });
            const deltaMessage = message as QueryDeltaMessage;
            const { documents, queries } = deltaMessage

            if (documents) {
              store.set(documentsAtom, (prev) => ({ ...prev, ...documents }));
            }

            if (queries) {
              for (const queryId in queries) {
                const targetQueryAtom = queryStateFamily(queryId);
                store.set(targetQueryAtom, queries[queryId]);
              }
            }
          } else if (message.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
          } else if (message.type === "error") {
            addLog({ type: 'incoming', payload: message });
            console.error("[ESAV] Received error from server:", message.error);
          }
        } catch (e) {
          console.error("[ESAV] Failed to parse message from server", e);
        }
      };
      ws.onclose = () => {
        console.log("[ESAV] WebSocket connection closed");
        setWebsocket(null);
        if (isUnmounting.current) {
          console.log("[ESAV] Unmounting, not reconnecting.");
          return;
        }

        setWebsocketStatus("closed");

        const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000);
        console.log(`[ESAV] Will attempt to reconnect in ${delay / 1000}s`);
        reconnectAttempts++;

        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = (err) => {
        console.error("[ESAV] WebSocket error", err);
        ws.close();
      };
    };

    isUnmounting.current = false;
    connect();

    return () => {
      isUnmounting.current = true;
      console.log(
        "[ESAV] Provider unmounting. Cleaning up timers and connection."
      );
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      const currentWs = store.get(websocketAtom);
      if (currentWs) {
        currentWs.onclose = null;
        currentWs.close();
      }
    };
  }, [url, store, setWebsocket, setWebsocketStatus]);

  return <>{children}</>;
}
