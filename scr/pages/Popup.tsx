import { useEffect, useState } from "react";

/**
 * Popup page - receives translations via postMessage from main window.
 * Open via window.open('/popup', 'translation_popup', 'width=480,height=280')
 */
export default function Popup() {
  const [lines, setLines] = useState<string[]>([]);
  const [pending, setPending] = useState("");

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || e.data.type !== "TRANSLATION") return;
      const text: string = e.data.text || "";
      const isFinal: boolean = e.data.isFinal;
      if (isFinal) {
        setLines((prev) => [...prev.slice(-19), text]);
        setPending("");
      } else {
        setPending(text);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <div
      style={{
        margin: 0,
        padding: "12px 16px",
        background: "#0d0d0d",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#555",
          borderBottom: "1px solid #222",
          paddingBottom: 6,
          marginBottom: 4,
        }}
      >
        HE → RU • перевод
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              fontSize: 22,
              color: "#f0f0f0",
              lineHeight: 1.35,
              wordBreak: "break-word",
            }}
          >
            {line}
          </div>
        ))}
        {pending && (
          <div
            style={{
              fontSize: 22,
              color: "#888",
              lineHeight: 1.35,
              wordBreak: "break-word",
              fontStyle: "italic",
            }}
          >
            {pending}
          </div>
        )}
        {lines.length === 0 && !pending && (
          <div style={{ color: "#444", fontSize: 14, marginTop: 20 }}>
            Ожидание перевода…
          </div>
        )}
      </div>
    </div>
  );
}
