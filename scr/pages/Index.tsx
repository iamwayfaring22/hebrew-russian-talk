import { useState, useEffect, useRef } from "react";
import { useSubtitleSession } from "@/hooks/useSubtitleSession";
import { WebSpeechProvider } from "@/services/stt/WebSpeechProvider";
import { MockTranslationService } from "@/services/translation/MockTranslationService";
import type { STTProvider } from "@/services/stt/types";

export default function Index() {
  const providerRef = useRef<STTProvider>(new WebSpeechProvider());
  const translationService = useRef(new MockTranslationService()).current;
  const scrollRef = useRef<HTMLDivElement>(null);

  const { state, startSession, stopSession, isRunning } = useSubtitleSession(
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Partial (last non-final message being typed)
  const partial = [...state.messages].reverse().find((m) => !m.isFinal);

  // Final messages only, for history list
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
        padding: "8px 16px",
        borderBottom: "1px solid #1a1a1a",
        fontSize: 12,
        color: "#444",
      }}>
        <span>HE → RU</span>
        <span style={{ color: isRunning ? "#4ade80" : "#333" }}>
          {isRunning ? `● ${fmt(callSeconds)}` : —}
        </span>
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
          gap: 16,
        }}
      >
        {/* Placeholder when idle */}
        {finals.length === 0 && !partial && (
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#2a2a2a",
            fontSize: 15,
            textAlign: "center",
          }}>
            {isRunning ? "Слушаю…" : "Нажмите СТАРТ"}
          </div>
        )}

        {/* Final messages */}
        {finals.map((msg) => (
          <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Hebrew original - small, gray, RTL */}
            <div style={{
              fontSize: 15,
              color: "#555",
              direction: "rtl",
              lineHeight: 1.4,
              wordBreak: "break-word",
            }}>
              {msg.original}
            </div>
            {/* Russian translation - bigger, white */}
            <div style={{
              fontSize: 20,
              color: "#f0f0f0",
              lineHeight: 1.35,
              wordBreak: "break-word",
            }}>
              {msg.translated || "…"}
            </div>
          </div>
        ))}

        {/* Partial (currently speaking) */}
        {partial && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, opacity: 0.5 }}>
            <div style={{
              fontSize: 15,
              color: "#555",
              direction: "rtl",
              lineHeight: 1.4,
              wordBreak: "break-word",
            }}>
              {partial.original}
            </div>
            <div style={{
              fontSize: 20,
              color: "#888",
              lineHeight: 1.35,
              fontStyle: "italic",
            }}>
              …
            </div>
          </div>
        )}

        {/* Error */}
        {state.error && state.error.includes("no-speech") === false && (
          <div style={{ fontSize: 12, color: "#f87171", textAlign: "center" }}>
            {state.error}
          </div>
        )}
      </div>

      {/* START/STOP button */}
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
