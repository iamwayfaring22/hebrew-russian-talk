import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SessionState,
  PipelineStage,
  STTProvider,
  STTStatus,
  TranscriptChunk,
  TranslationService,
} from "@/services/stt/types";

// Simple SubtitleMessage for internal use
interface SubtitleMessage {
  id: string;
  original: string;
  translated: string;
  isFinal: boolean;
  timestamp: number;
}

const STT_TO_PIPELINE: Record<STTStatus, PipelineStage> = {
  idle: "idle",
  requesting_permission: "requesting_permission",
  ready: "mic_ready",
  listening: "listening",
  partial_result: "speech_detected",
  final_result: "speech_detected",
  error: "error",
};

const INITIAL_STATE: SessionState = {
  phase: "stopped",
  pipelineStage: "idle",
  messages: [],
  error: null,
  startedAt: null,
  micPermission: "unknown",
};

export function useSubtitleSession(
  sttProvider: STTProvider,
  translationService: TranslationService
) {
  const [state, setState] = useState<SessionState>(INITIAL_STATE);
  const providerRef = useRef(sttProvider);
  const translationRef = useRef(translationService);
  const popupRef = useRef<Window | null>(null);

  // Latest partial text - debounced, not written to state on every event
  const partialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPartialRef = useRef<TranscriptChunk | null>(null);

  useEffect(() => { providerRef.current = sttProvider; }, [sttProvider]);
  useEffect(() => { translationRef.current = translationService; }, [translationService]);

  // Send TRANSLATED (Russian) text to popup window
  const sendToPopup = useCallback((russianText: string) => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.postMessage({ type: "TRANSLATION", text: russianText, isFinal: true }, "*");
    }
  }, []);

  // Open popup window
  const openPopup = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
      return;
    }
    const w = window.open(
      "/popup",
      "translation_popup",
      "width=500,height=300,top=50,left=50,resizable=yes,scrollbars=yes"
    );
    popupRef.current = w;
  }, []);

  const updatePipeline = useCallback((stage: PipelineStage) => {
    setState((prev) => ({ ...prev, pipelineStage: stage }));
  }, []);

  const handleStatusChange = useCallback(
    (status: STTStatus) => {
      const stage = STT_TO_PIPELINE[status];
      setState((prev) => ({
        ...prev,
        pipelineStage: stage,
        micPermission:
          status === "requesting_permission" ? "unknown"
          : status === "ready" || status === "listening" ? "granted"
          : prev.micPermission,
      }));
    },
    []
  );

  // PARTIAL: debounce - only update state after 150ms quiet
  const handlePartialResult = useCallback(
    (chunk: TranscriptChunk) => {
      latestPartialRef.current = chunk;
      if (partialTimerRef.current) clearTimeout(partialTimerRef.current);
      partialTimerRef.current = setTimeout(() => {
        const c = latestPartialRef.current;
        if (!c) return;
        const msg: SubtitleMessage = {
          id: c.id,
          original: c.text,
          translated: "",
          isFinal: false,
          timestamp: c.timestamp,
        };
        setState((prev) => {
          const existing = prev.messages.findIndex((m) => m.id === c.id);
          if (existing >= 0) {
            const updated = [...prev.messages];
            updated[existing] = msg;
            return { ...prev, pipelineStage: "speech_detected", messages: updated };
          }
          return { ...prev, pipelineStage: "speech_detected", messages: [...prev.messages, msg] };
        });
      }, 150);
    },
    []
  );

  // FINAL: translate once, update message, send RUSSIAN to popup
  const handleFinalResult = useCallback(
    async (chunk: TranscriptChunk) => {
      if (partialTimerRef.current) {
        clearTimeout(partialTimerRef.current);
        partialTimerRef.current = null;
      }
      latestPartialRef.current = null;

      setState((prev) => ({ ...prev, pipelineStage: "translating" }));

      let translated: string;
      try {
        translated = await translationRef.current.translate(chunk.text, "he", "ru");
      } catch {
        translated = "[ошибка перевода]";
      }

      const msg: SubtitleMessage = {
        id: chunk.id,
        original: chunk.text,
        translated,
        isFinal: true,
        timestamp: chunk.timestamp,
      };

      setState((prev) => {
        const existing = prev.messages.findIndex((m) => m.id === chunk.id);
        if (existing >= 0) {
          const updated = [...prev.messages];
          updated[existing] = msg;
          return { ...prev, pipelineStage: "translated", messages: updated };
        }
        return { ...prev, pipelineStage: "translated", messages: [...prev.messages, msg] };
      });

      // Send RUSSIAN translation to popup
      sendToPopup(translated);

      setTimeout(() => {
        if (providerRef.current.getStatus() === "listening") {
          setState((prev) => ({ ...prev, pipelineStage: "listening" }));
        }
      }, 500);
    },
    [sendToPopup]
  );

  const handleError = useCallback((error: Error) => {
    const msg = error.message.toLowerCase();
    const isDenied = msg.includes("denied") || msg.includes("permission");
    const isNoSpeech = msg.includes("no-speech");
    if (isNoSpeech) {
      setState((prev) => ({ ...prev, error: error.message }));
      return;
    }
    setState((prev) => ({
      ...prev,
      pipelineStage: "error",
      error: error.message,
      micPermission: isDenied ? "denied" : prev.micPermission,
    }));
  }, []);

  const startSession = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      phase: "starting",
      error: null,
      messages: [],
      startedAt: Date.now(),
    }));
    try {
      await providerRef.current.initialize({
        onPartialResult: handlePartialResult,
        onFinalResult: handleFinalResult,
        onError: handleError,
        onStatusChange: handleStatusChange,
      });
      await providerRef.current.start();
      setState((prev) => ({ ...prev, phase: "running" }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        phase: "stopped",
        pipelineStage: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, [handlePartialResult, handleFinalResult, handleError, handleStatusChange]);

  const stopSession = useCallback(async () => {
    if (partialTimerRef.current) {
      clearTimeout(partialTimerRef.current);
      partialTimerRef.current = null;
    }
    setState((prev) => ({ ...prev, phase: "stopping" }));
    try { await providerRef.current.stop(); } catch { /* ignore */ }
    setState((prev) => ({ ...prev, phase: "stopped", pipelineStage: "idle" }));
  }, []);

  const clearMessages = useCallback(() => {
    setState((prev) => ({ ...prev, messages: [], startedAt: null }));
  }, []);

  useEffect(() => {
    return () => {
      if (partialTimerRef.current) clearTimeout(partialTimerRef.current);
      providerRef.current.dispose();
    };
  }, []);

  return {
    state,
    startSession,
    stopSession,
    clearMessages,
    openPopup,
    isRunning: state.phase === "running" || state.phase === "starting",
    isStopping: state.phase === "stopping",
  };
}
