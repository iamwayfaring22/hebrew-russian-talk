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

      <div style={{
        flexShrink: 0,
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 16px",
        borderBottom: "1px solid #1a1a1a",
        fontSize: 12,
        color: "#444",
      }}>
        <span>HE &rarr; RU</span>
        <span style={{ color: isRunning ? "#4ade80" : "#333" }}>
          {isRunning ? `\u25cf ${fmt(callSeconds)}` : "\u2014"}
        </span>
      </div>

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
            {isRunning ? "\u0421\u043b\u0443\u0448\u0430\u044e\u2026" : "\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u0421\u0422\u0410\u0420\u0422"}
          </div>
        )}

        {finals.map((msg) => (
          <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{
              fontSize: 15,
              color: "#555",
              direction: "rtl",
              lineHeight: 1.4,
              wordBreak: "break-word",
            }}>
              {msg.original}
            </div>
            <div style={{
              fontSize: 20,
              color: "#f0f0f0",
              lineHeight: 1.35,
              wordBreak: "break-word",
            }}>
              {msg.translated || "\u2026"}
            </div>
          </div>
        ))}

        {partial && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, opacity: 0.45 }}>
            <div style={{
              fontSize: 15,
              color: "#555",
              direction: "rtl",
              lineHeight: 1.4,
              wordBreak: "break-word",
            }}>
              {partial.original}
            </div>
            <div style={{ fontSize: 20, color: "#666", lineHeight: 1.35 }}>
              \u2026
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
          {isRunning ? "\u23f9 \u0421\u0422\u041e\u041f" : "\u25b6 \u0421\u0422\u0410\u0420\u0422"}
        </button>
      </div>
    </div>
  );
}
