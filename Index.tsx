import { useState, useEffect, useRef, useCallback } from "react";
import { StatusBar } from "@/components/StatusBar";
import { TechStatus } from "@/components/TechStatus";
import { TranscriptMessage } from "@/components/TranscriptMessage";
import { ControlsPanel } from "@/components/ControlsPanel";
import { ListeningIndicator } from "@/components/ListeningIndicator";
import { DebugPanel, type DebugEvent } from "@/components/DebugPanel";
import { useSubtitleSession } from "@/hooks/useSubtitleSession";
import { MockSTTProvider } from "@/services/stt/MockSTTProvider";
import { WebSpeechProvider } from "@/services/stt/WebSpeechProvider";
import { MockTranslationService } from "@/services/translation/MockTranslationService";
import type { PipelineStage, STTProvider } from "@/services/stt/types";

type ProviderKey = "mock" | "web-speech";

function createProvider(key: ProviderKey): STTProvider {
  return key === "mock" ? new MockSTTProvider() : new WebSpeechProvider();
}

const fmtNow = () =>
  new Date().toLocaleTimeString("ru-RU", { minute: "2-digit", second: "2-digit" });

export default function Index() {
  const [providerKey, setProviderKey] = useState<ProviderKey>("mock");
  const [provider, setProvider] = useState<STTProvider>(() => createProvider("mock"));
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const translationService = useRef(new MockTranslationService()).current;

  const pushEvent = useCallback((event: string, detail?: string) => {
    setDebugEvents((prev) => [...prev.slice(-49), { time: fmtNow(), event, detail }]);
  }, []);

  // Wrap provider to intercept events for debug log
  const wrappedProvider = useRef<STTProvider | null>(null);
  const lastRawProvider = useRef<STTProvider | null>(null);

  // Build a wrapping proxy that logs events — only when the raw provider actually changes
  if (lastRawProvider.current !== provider) {
    lastRawProvider.current = provider;
    const p = provider;
    wrappedProvider.current = {
      get name() { return p.name; },
      async initialize(events) {
        pushEvent("initialize", `provider=${p.name}`);
        await p.initialize({
          onPartialResult(chunk) {
            pushEvent("onPartialResult", chunk.text.slice(0, 40));
            events.onPartialResult(chunk);
          },
          onFinalResult(chunk) {
            pushEvent("onFinalResult", chunk.text.slice(0, 40));
            events.onFinalResult(chunk);
          },
          onError(err) {
            pushEvent("onError", err.message);
            events.onError(err);
          },
          onStatusChange(status) {
            pushEvent("onStatusChange", status);
            events.onStatusChange(status);
          },
        });
      },
      async start() {
        pushEvent("start");
        await p.start();
      },
      async stop() {
        pushEvent("stop");
        await p.stop();
      },
      dispose() {
        pushEvent("dispose");
        p.dispose();
      },
      getStatus() { return p.getStatus(); },
    };
  }

  const { state, startSession, stopSession, isRunning } =
    useSubtitleSession(wrappedProvider.current!, translationService);

  const [callSeconds, setCallSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Timer
  useEffect(() => {
    if (!isRunning) return;
    setCallSeconds(0);
    const timer = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state.messages]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handleToggle = () => {
    if (isRunning) stopSession();
    else startSession();
  };

  // Switch provider — full reset
  const handleProviderChange = useCallback(
    (key: ProviderKey) => {
      if (isRunning) return; // safety
      // Dispose old
      provider.dispose();
      pushEvent("provider_switch", `${providerKey} → ${key}`);
      // Create new
      const next = createProvider(key);
      setProvider(next);
      setProviderKey(key);
      setDebugEvents([{ time: fmtNow(), event: "provider_switch", detail: `active: ${key}` }]);
    },
    [isRunning, provider, providerKey, pushEvent]
  );

  // Pipeline mapping
  const listenState: "listening" | "translating" | "idle" =
    state.pipelineStage === "listening"
      ? "listening"
      : state.pipelineStage === "speech_detected" || state.pipelineStage === "translating"
      ? "translating"
      : "idle";

  const lastFinal = [...state.messages].reverse().find((m) => m.isFinal);
  const confidence = lastFinal ? Math.floor(85 + Math.random() * 14) : 0;
  const techStage: PipelineStage = state.pipelineStage;

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <StatusBar confidence={confidence} callDuration={formatTime(callSeconds)} isOnline={true} />
      <TechStatus stage={techStage} isRunning={isRunning} />

      {/* Transcript area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {!isRunning && state.messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3 px-6">
              <p className="text-lg font-semibold text-foreground">Субтитры звонка</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Включите громкую связь на телефоне и нажмите «Старт».
                Приложение слушает речь через микрофон и показывает перевод с иврита на русский.
              </p>
              <div className="mt-2 px-3 py-2 rounded-md bg-accent/50 border border-border">
                <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                  ⚠ Браузерный прототип · {providerKey === "mock" ? "MockSTTProvider" : "WebSpeechProvider"} · не финальный Android-режим
                </p>
              </div>
            </div>
          </div>
        )}

        {isRunning && state.messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                {state.pipelineStage === "requesting_permission"
                  ? "Запрос доступа к микрофону…"
                  : state.pipelineStage === "mic_ready"
                  ? "Микрофон доступен · подготовка…"
                  : state.pipelineStage === "error"
                  ? "Ошибка — см. ниже"
                  : "Слушаю громкую связь…"}
              </p>
              <p className="text-xs text-muted-foreground/60">
                {state.pipelineStage === "listening"
                  ? "Речь не обнаружена · ожидание ивритской речи"
                  : "Ожидание ивритской речи"}
              </p>
            </div>
          </div>
        )}

        {state.error && (
          <div className="mx-2 p-3 rounded-lg bg-destructive/10 text-sm space-y-1">
            <p className="text-destructive font-medium">{state.error}</p>
            <p className="text-destructive/70 text-xs">
              {state.error.includes("not supported")
                ? "Диагностика: Web Speech API не поддерживается. Используйте Chrome."
                : state.error.includes("denied") || state.error.includes("not-allowed")
                ? "Диагностика: микрофон заблокирован. Разрешите доступ в настройках."
                : state.error.includes("no-speech")
                ? "Диагностика: тишина — проверьте громкую связь."
                : state.error.includes("aborted")
                ? "Диагностика: распознавание прервано (aborted)."
                : state.error.includes("network")
                ? "Диагностика: сетевая ошибка — проверьте интернет."
                : "Диагностика: проверьте подключение и попробуйте снова."}
            </p>
          </div>
        )}

        {state.messages.map((msg) => (
          <TranscriptMessage
            key={msg.id}
            message={{
              id: msg.id,
              original: msg.original,
              translated: msg.translated,
              speaker: "remote",
              timestamp: new Date(msg.timestamp).toLocaleTimeString("ru-RU", {
                minute: "2-digit",
                second: "2-digit",
              }),
              isFinal: msg.isFinal,
            }}
          />
        ))}
        {isRunning && state.messages.length > 0 && <ListeningIndicator state={listenState} />}
      </div>

      {/* Debug panel — above controls */}
      <DebugPanel
        activeProvider={providerKey}
        onProviderChange={handleProviderChange}
        events={debugEvents}
        disabled={isRunning}
      />

      <ControlsPanel
        isRunning={isRunning}
        isMicActive={state.micPermission === "granted" || state.micPermission === "unknown"}
        onToggleRunning={handleToggle}
      />
    </div>
  );
}
