import { useState, useEffect, useRef } from "react";
import { useSubtitleSession } from "@/hooks/useSubtitleSession";
import { WebSpeechProvider } from "@/services/stt/WebSpeechProvider";
import { MockTranslationService } from "@/services/translation/MockTranslationService";
import type { STTProvider } from "@/services/stt/types";

export default function Index() {
  const providerRef = useRef<STTProvider>(new WebSpeechProvider());
  const translationService = useRef(new MockTranslationService()).current;
  const scrollRef = useRef<HTMLDivElement>(null);

  const { state, startSession, stopSession, isRunning, openPopup } = useSubtitleSession(
    providerRef.current,
    translationService
  );

  const [callSeconds, setCallSeconds] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    setCallSeconds(0);
    const t = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isRunning]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const partial = [...state.messages].reverse().find((m) => !m.isFinal);
  const finals = state.messages.filter((m) => m.isFinal);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100dvh",
      background: "#0a0a0a",
      color: "#f0f0f0",
      fontFamily: "system-ui, sans-serif",
      overflow: "hidden",
    }}>

      {/* Status bar */}
      <div style={{
        flexShrink: 0,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 16px",
        borderBottom: "1px solid #1a1a1a",
        fontSize: 12,
        color: "#444",
      }}>
        <span>HE → RU</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: isRunning ? "#4ade80" : "#333" }}>
            {isRunning ? `● ${fmt(callSeconds)}` : "—"}
          </span>
          <button
            onClick={openPopup}
            title="Открыть попап-окно перевода"
            style={{
              background: "none",
              border: "1px solid #333",
              borderRadius: 6,
              color: "#888",
              cursor: "pointer",
              fontSize: 12,
              padding: "2px 8px",
            }}
          >
            ↗ попап
          </button>
        </div>
      </div>

      {/* Scrollable messages area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {finals.length === 0 && !partial && (
          <div style={{ color: "#333", textAlign: "center", marginTop: 40, fontSize: 14 }}>
            {isRunning ? "Слушаю…" : "Нажмите СТАРТ"}
          </div>
        )}

        {finals.map((msg) => (
          <div key={msg.id} style={{ borderBottom: "1px solid #111", paddingBottom: 8 }}>
            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.4, wordBreak: "break-word" }}>
              {msg.original}
            </div>
            <div style={{ fontSize: 17, color: "#e0e0e0", lineHeight: 1.4, wordBreak: "break-word", marginTop: 2 }}>
              {msg.translated || "…"}
            </div>
          </div>
        ))}

        {partial && (
          <div>
            <div style={{ fontSize: 13, color: "#444", lineHeight: 1.4, wordBreak: "break-word" }}>
              {partial.original}
            </div>
            <div style={{ fontSize: 20, color: "#666", lineHeight: 1.35 }}>
              &#x2026;
            </div>
          </div>
        )}

        {state.error && !state.error.includes("no-speech") && (
          <div style={{ fontSize: 12, color: "#f87171", textAlign: "center" }}>
            {state.error}
          </div>
        )}
      </div>

      <div style={{
        flexShrink: 0,
        padding: "12px 16px 20px",
        borderTop: "1px solid #1a1a1a",
      }}>
        <button
          onClick={() => isRunning ? stopSession() : startSession()}
          style={{
            width: "100%",
            fontSize: 20,
            fontWeight: 700,
            padding: "18px",
            borderRadius: 12,
            border: "none",
            background: isRunning ? "#7f1d1d" : "#14532d",
            color: isRunning ? "#fca5a5" : "#86efac",
            cursor: "pointer",
            letterSpacing: 1,
          }}
        >
          {isRunning ? "⏹ СТОП" : "▶ СТАРТ"}
        </button>
      </div>
    </div>
  );
}
