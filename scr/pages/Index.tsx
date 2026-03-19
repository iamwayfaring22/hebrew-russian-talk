import { useState, useEffect, useRef } from "react";
import { useSubtitleSession } from "@/hooks/useSubtitleSession";
import type { TranslationDirection } from "@/hooks/useSubtitleSession";
import { WebSpeechProvider } from "@/services/stt/WebSpeechProvider";
import { MockTranslationService } from "@/services/translation/MockTranslationService";
import type { STTProvider } from "@/services/stt/types";

export default function Index() {
  const providerRef = useRef<STTProvider>(new WebSpeechProvider());
  const translationService = useRef(new MockTranslationService()).current;
  const scrollRef = useRef<HTMLDivElement>(null);

  const { state, direction, startSession, stopSession, isRunning, openPopup } =
    useSubtitleSession(providerRef.current, translationService);

  const [callSeconds, setCallSeconds] = useState(0);
  // Selected direction (before session starts or after stop)
  const [selectedDir, setSelectedDir] = useState<TranslationDirection>("he->ru");

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

  const activeDir = isRunning ? direction : selectedDir;
  const isHeRu = activeDir === "he->ru";

  // Label helpers
  const dirLabel = isHeRu ? "ОН (ивр → рус)" : "Я (рус → ивр)";
  const srcLabel = isHeRu ? "иврит" : "русский";
  const dstLabel = isHeRu ? "русский" : "иврит";

  const handleToggleDir = () => {
    if (isRunning) return; // can't switch while running
    setSelectedDir((d) => (d === "he->ru" ? "ru->he" : "he->ru"));
  };

  const handleStart = () => {
    if (isRunning) {
      stopSession();
    } else {
      startSession(selectedDir);
    }
  };

  // Color accent per direction
  const accent = isHeRu ? "#4ade80" : "#60a5fa";
  const btnBg = isRunning
    ? "#7f1d1d"
    : isHeRu ? "#14532d" : "#1e3a5f";
  const btnColor = isRunning
    ? "#fca5a5"
    : isHeRu ? "#86efac" : "#93c5fd";

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100dvh",
      background: "#0a0a0a", color: "#f0f0f0",
      fontFamily: "system-ui, sans-serif", overflow: "hidden",
    }}>

      {/* Status bar */}
      <div style={{
        flexShrink: 0, display: "flex", justifyContent: "space-between",
        alignItems: "center", padding: "8px 16px",
        borderBottom: "1px solid #1a1a1a", fontSize: 12, color: "#444",
      }}>
        <span style={{ color: accent, fontWeight: 600 }}>{dirLabel}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: isRunning ? accent : "#333" }}>
            {isRunning ? `● ${fmt(callSeconds)}` : "—"}
          </span>
          <button onClick={openPopup} style={{
            background: "none", border: "1px solid #333", borderRadius: 6,
            color: "#888", cursor: "pointer", fontSize: 12, padding: "2px 8px",
          }}>
            ↗ попап
          </button>
        </div>
      </div>

      {/* Mode toggle — only when stopped */}
      {!isRunning && (
        <div style={{
          flexShrink: 0, display: "flex", gap: 0,
          margin: "10px 16px 0", borderRadius: 10, overflow: "hidden",
          border: "1px solid #222",
        }}>
          {(["he->ru", "ru->he"] as TranslationDirection[]).map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDir(d)}
              style={{
                flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600, transition: "all 0.15s",
                background: selectedDir === d ? (d === "he->ru" ? "#14532d" : "#1e3a5f") : "#111",
                color: selectedDir === d ? (d === "he->ru" ? "#86efac" : "#93c5fd") : "#444",
              }}
            >
              {d === "he->ru" ? "📢 ОН — ивр→рус" : "💬 Я — рус→ивр"}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: "auto", padding: "12px 16px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {finals.length === 0 && !partial && (
          <div style={{ color: "#333", textAlign: "center", marginTop: 40, fontSize: 14 }}>
            {isRunning
              ? `Слушаю ${srcLabel}…`
              : `Выберите режим и нажмите СТАРТ`
            }
          </div>
        )}

        {finals.map((msg: any) => (
          <div key={msg.id} style={{ borderBottom: "1px solid #111", paddingBottom: 8 }}>
            <div style={{ fontSize: 13, color: "#888", lineHeight: 1.4, wordBreak: "break-word" }}>
              {msg.original}
            </div>
            <div style={{
              fontSize: 17, lineHeight: 1.4, wordBreak: "break-word", marginTop: 2,
              color: msg.direction === "he->ru" ? "#e0e0e0" : "#93c5fd",
            }}>
              {msg.translated || "…"}
            </div>
          </div>
        ))}

        {partial && (
          <div>
            <div style={{ fontSize: 13, color: "#777", lineHeight: 1.4, wordBreak: "break-word" }}>
              {partial.original}
            </div>
            <div style={{ fontSize: 20, color: "#666", lineHeight: 1.35 }}>…</div>
          </div>
        )}

        {state.error && !state.error.includes("no-speech") && (
          <div style={{ fontSize: 12, color: "#f87171", textAlign: "center" }}>
            {state.error}
          </div>
        )}
      </div>

      {/* Start/Stop button */}
      <div style={{ flexShrink: 0, padding: "12px 16px 20px", borderTop: "1px solid #1a1a1a" }}>
        <button
          onClick={handleStart}
          style={{
            width: "100%", fontSize: 20, fontWeight: 700, padding: "18px",
            borderRadius: 12, border: "none",
            background: btnBg, color: btnColor,
            cursor: "pointer", letterSpacing: 1,
          }}
        >
          {isRunning ? `⏹ СТОП` : `▶ СТАРТ`}
        </button>
      </div>
    </div>
  );
}
