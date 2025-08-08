import { useAtomValue } from "jotai";
import { useState } from "react";
import { websocketStatusAtom, logEntriesAtom } from "./atoms";
import type { LogEntry } from "./types";


export function ReconnectingHeader() {
  const status = useAtomValue(websocketStatusAtom);

  if (status === "open") {
    return null;
  }

  const message =
    status === "connecting"
      ? "Connecting to ESAV Live..."
      : "Connection lost. Attempting to reconnect...";

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        left: 0,
        width: "100%",
        padding: "8px",
        backgroundColor: "#ffc107",
        color: "#333",
        textAlign: "center",
        fontWeight: "bold",
        zIndex: 1000,
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      {message}
    </div>
  );
}

const LogEntryItem = ({ entry }: { entry: LogEntry }) => {
  const { type, timestamp, payload } = entry;

  const typeStyles = {
    incoming: { icon: "⬇️", color: "#4caf50", name: "Incoming" },
    outgoing: { icon: "⬆️", color: "#ffeb3b", name: "Outgoing" },
    status: { icon: "ℹ️", color: "#2196f3", name: "Status" },
    error: { icon: "❌", color: "#f44336", name: "Error" },
  };

  const { icon, color, name } = typeStyles[type];

  return (
    <div
      style={{
        borderBottom: "1px solid #444",
        padding: "8px",
        fontFamily: "monospace",
        fontSize: "12px",
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
        <span style={{ marginRight: "8px" }}>{icon}</span>
        {name}
        <span style={{ float: "right", color: "#888" }}>
          {timestamp.toLocaleTimeString()}
        </span>
      </div>
      {typeof payload === "object" ? (
        <pre
          style={{
            margin: 0,
            padding: "8px",
            backgroundColor: "rgba(0,0,0,0.2)",
            borderRadius: "4px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            fontSize: "11px",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : (
        <code style={{ color: "#ccc" }}>{String(payload)}</code>
      )}
    </div>
  );
};

export function DeltaLogViewer() {
  const [open, setOpen] = useState(false);
  const log = useAtomValue(logEntriesAtom);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "10px",
        right: "10px",
        width: open ? "min(850px,90dvw)" : "280px",
        backgroundColor: "#2d2d2d",
        color: "#f1f1f1",
        border: "1px solid #555",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        zIndex: 2000,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        maxHeight: "600px",
        transition: "width 0.1s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          backgroundColor: "#3c3c3c",
          borderBottom: "1px solid #555",
          fontWeight: 700,
        }}
      >
        <span>ESAV Live Log</span>
        <button
          onClick={() => setOpen(!open)}
          style={{
            background: "transparent",
            border: "none",
            color: "#ccc",
            fontSize: "16px",
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: "4px",
            transition: "background 0.01s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#444")}
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
          title={open ? "Collapse log" : "Expand log"}
        >
          {open ? "close" : "open"}
        </button>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: open ? "flex" : "none",
          flexDirection: "column",
        }}
      >
        {log.length === 0 ? (
          <div style={{ padding: "10px", color: "#888" }}>
            Waiting for events...
          </div>
        ) : (
          log.map((entry) => <LogEntryItem key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}