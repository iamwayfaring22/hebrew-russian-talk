import { useState, useEffect, useRef, useCallback } from "react";
import { useSubtitleSession } from "@/hooks/useSubtitleSession";
import { MockSTTProvider } from "@/services/stt/MockSTTProvider";
import { WebSpeechProvider } from "@/services/stt/WebSpeechProvider";
import { MockTranslationService } from "@/services/translation/MockTranslationService";
import type { STTProvider } from "@/services/stt/types";

type ProviderKey = "mock" | "web-speech";

function createProvider(key: ProviderKey): STTProvider {
  return key === "mock" ? new MockSTTProvider() : new WebSpeechProvider();
}

export default function Index() {
  const [providerKey, setProviderKey] = useState<ProviderKey>("web-speech");
  const [provider, setProvider] = useState<STTProvider>(() => createProvider("web-speech"));
  const translationService = useRef(new MockTranslationService()).current;

  const { state, startSession, stopSession, openPopup, isRunning } = useSubtitleSession(
    provider,
    translationService
  );

  const [callSeconds, setCallSeconds] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    setCallSeconds(0);
    const timer = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handleToggle = () => {
    if (isRunning) stopSession();
    else startSession();
  };

  // Last final translated message
  const lastFinal = [...state.messages].reverse().find((m) => m.isFinal);
  // Latest partial (non-final)
  const lastPartial = [...state.messages].reverse().find((m) => !m.isFinal);

  const displayOriginal = lastPartial?.original || lastFinal?.original || "";
  const displayTranslated = lastFinal?.translated || "";

  const statusText =
    !isRunning
      ? "Нажмите «Старт» и говорите по-ивритски"
      : state.pipelineStage === "requesting_permission"
      ? "Запрос доступа к микрофону…"
      : state.pipelineStage === "translating"
      ? "Перевожу…"
      : state.pipelineStage === "error"
      ? "Ошибка"
      : state.pipelineStage === "speech_detected"
      ? "Распознаю…"
      : "Слушаю…";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100dvh",
      background: "#0a0a0a",
      color: "#f0f0f0",
      fontFamily: "system-ui, sans-serif",
      userSelect: "none",
    }}>

      {/* Timer + status bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 16px 6px",
        borderBottom: "1px solid #1f1f1f",
        fontSize: 13,
        color: "#555",
        flexShrink: 0,
      }}>
        <span>HE → RU</span>
        <span style={{ color: isRunning ? "#4ade80" : "#444" }}>
          {isRunning ? `● ${formatTime(callSeconds)}` : "●●●"}
        </span>
        <span style={{ color: "#333", fontSize: 11 }}>{providerKey}</span>
      </div>

      {/* MAIN TRANSLATION AREA */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px 20px",
        gap: 20,
        overflow: "hidden",
      }}>
        {/* Russian translation - big */}
        <div style={{
          fontSize: 34,
          fontWeight: 600,
          lineHeight: 1.3,
          textAlign: "center",
          color: displayTranslated ? "#f0f0f0" : "#2a2a2a",
          wordBreak: "break-word",
          minHeight: 90,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {displayTranslated || (
            isRunning
              ? <span style={{ color: "#333", fontSize: 22 }}>{statusText}</span>
              : <span style={{ color: "#222", fontSize: 18 }}>Перевод появится здесь</span>
          )}
        </div>

        {/* Hebrew original - smaller, below */}
        {displayOriginal && (
          <div style={{
            fontSize: 18,
            color: "#444",
            textAlign: "center",
            direction: "rtl",
            wordBreak: "break-word",
            lineHeight: 1.4,
          }}>
            {displayOriginal}
          </div>
        )}

        {/* Error */}
        {state.error && (
          <div style={{
            fontSize: 12,
            color: "#f87171",
            textAlign: "center",
            maxWidth: 300,
          }}>
            {state.error}
          </div>
        )}
      </div>

      {/* CONTROLS */}
      <div style={{
        flexShrink: 0,
        padding: "12px 20px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        borderTop: "1px solid #1a1a1a",
      }}>
        {/* Provider toggle */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {(["web-speech", "mock"] as ProviderKey[]).map((k) => (
            <button
              key={k}
              disabled={isRunning}
              onClick={() => {
                if (isRunning) return;
                provider.dispose();
                const next = createProvider(k);
                setProvider(next);
                setProviderKey(k);
              }}
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 4,
                border: providerKey === k ? "1px solid #4ade80" : "1px solid #333",
                background: providerKey === k ? "#052e16" : "transparent",
                color: providerKey === k ? "#4ade80" : "#555",
                cursor: isRunning ? "default" : "pointer",
              }}
            >
              {k === "web-speech" ? "WebSpeech" : "Mock"}
            </button>
          ))}
          <button
            onClick={openPopup}
            style={{
              fontSize: 11,
              padding: "3px 10px",
              borderRadius: 4,
              border: "1px solid #333",
              background: "transparent",
              color: "#555",
              cursor: "pointer",
            }}
          >
            □ Окно
          </button>
        </div>

        {/* BIG START/STOP BUTTON */}
        <button
          onClick={handleToggle}
          style={{
            fontSize: 20,
            fontWeight: 700,
            padding: "18px",
            borderRadius: 12,
            border: "none",
            background: isRunning ? "#7f1d1d" : "#14532d",
            color: isRunning ? "#fca5a5" : "#86efac",
            cursor: "pointer",
            letterSpacing: 1,
            transition: "background 0.15s",
          }}
        >
          {isRunning ? "⏹ СТОП" : "▶ СТАРТ"}
        </button>
      </div>
    </div>
  );
}
