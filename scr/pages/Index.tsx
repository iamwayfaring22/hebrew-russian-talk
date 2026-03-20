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

  const dirLabel = isHeRu ? "ОН (ивр → рус)" : "Я (рус → ивр)";
  const srcLabel = isHeRu ? "иврит" : "русский";
  const dstLabel = isHeRu ? "русский" : "иврит";

  const handleToggleDir = () => {
    if (isRunning) return;
    setSelectedDir((d) => (d === "he->ru" ? "ru->he" : "he->ru"));
  };

  const handleStart = () => {
    if (isRunning) {
      stopSession();
    } else {
      startSession(selectedDir);
    }
  };

  const accent = isHeRu ? "#4ade80" : "#60a5fa";
  const btnBg = isRunning ? "#7f1d1d" : isHeRu ? "#14532d" : "#1e3a5f";
  const btnColor = isRunning ? "#fca5a5" : isHeRu ? "#86efac" : "#93c5fd";

  return (
    <div style={{ background: "#000", minHeight: "100dvh", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif", color: "#fff" }}>
      {/* Status bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <span style={{ color: accent, fontSize: 13, fontWeight: 600 }}>{dirLabel}</span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ color: "#555", fontSize: 12 }}>{isRunning ? `● ${fmt(callSeconds)}` : "—"}</span>
          <button onClick={openPopup} style={{ background: "none", border: "1px solid #333", color: "#888", fontSize: 11, padding: "3px 8px", borderRadius: 4, cursor: "pointer" }}>↗ попап</button>
        </div>
      </div>

      {/* Mode toggle */}
      {!isRunning && (
        <div style={{ display: "flex", background: "#111", borderBottom: "1px solid #1a1a1a" }}>
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

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: 10 }}>
        {finals.length === 0 && !partial && (
          <div style={{ color: "#444", textAlign: "center", marginTop: 40, fontSize: 14 }}>
            {isRunning ? `Слушаю ${srcLabel}…` : `Выберите режим и нажмите СТАРТ`}
          </div>
        )}

        {finals.map((msg: any) => (
          <div key={msg.id} style={{ background: "#0d0d0d", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ color: msg.direction === "he->ru" ? "#a3e635" : "#93c5fd", fontSize: 15, fontWeight: 500, direction: msg.direction === "he->ru" ? "rtl" : "ltr", textAlign: msg.direction === "he->ru" ? "right" : "left" }}>
              {msg.original}
            </div>
            <div style={{ color: msg.direction === "he->ru" ? "#e0e0e0" : "#93c5fd", fontSize: 14, marginTop: 4 }}>
              {msg.translated || "…"}
            </div>
          </div>
        ))}

        {partial && (
          <div style={{ background: "#111", borderRadius: 8, padding: "10px 12px", borderLeft: `3px solid ${accent}`, opacity: 0.85 }}>
            <div style={{ color: partial.direction === "he->ru" ? "#a3e635" : "#93c5fd", fontSize: 15, direction: partial.direction === "he->ru" ? "rtl" : "ltr", textAlign: partial.direction === "he->ru" ? "right" : "left" }}>
              {partial.original}
            </div>
            <div style={{ color: "#888", fontSize: 14, marginTop: 4 }}>
              {partial.translated || "…"}
            </div>
          </div>
        )}

        {state.error && !state.error.includes("no-speech") && (
          <div style={{ color: "#f87171", fontSize: 12, textAlign: "center" }}>{state.error}</div>
        )}
      </div>

      {/* Start/Stop */}
      <button
        onClick={handleStart}
        style={{ background: btnBg, color: btnColor, border: "none", padding: "18px", fontSize: 16, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}
      >
        {isRunning ? `⏹ СТОП` : `▶ СТАРТ`}
      </button>
    </div>
  );
}
