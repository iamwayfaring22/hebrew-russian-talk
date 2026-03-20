import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SessionState,
  PipelineStage,
  STTProvider,
  STTStatus,
  TranscriptChunk,
  TranslationService,
} from "@/services/stt/types";

export type TranslationDirection = "he->ru" | "ru->he";

interface SubtitleMessage {
  id: string;
  original: string;
  translated: string;
  isFinal: boolean;
  timestamp: number;
  direction: TranslationDirection;
}

const PARTIAL_ID = "__partial_live__";

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
  const [direction, setDirection] = useState<TranslationDirection>("he->ru");
  const providerRef = useRef(sttProvider);
  const translationRef = useRef(translationService);
  const popupRef = useRef<Window | null>(null);
  const partialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPartialRef = useRef<TranscriptChunk | null>(null);
  const directionRef = useRef<TranslationDirection>("he->ru");

  useEffect(() => { providerRef.current = sttProvider; }, [sttProvider]);
  useEffect(() => { translationRef.current = translationService; }, [translationService]);

  const sendToPopup = useCallback((text: string) => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.postMessage({ type: "TRANSLATION", text, isFinal: true }, "*");
    }
  }, []);

  const openPopup = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
      return;
    }
    const w = window.open("/#/popup", "translation_popup", "width=500,height=300,top=50,left=50,resizable=yes,scrollbars=yes");
    popupRef.current = w;
  }, []);

  const handleStatusChange = useCallback((status: STTStatus) => {
    const stage = STT_TO_PIPELINE[status];
    setState((prev) => ({
      ...prev,
      pipelineStage: stage,
      micPermission:
        status === "requesting_permission"
          ? "unknown"
          : status === "ready" || status === "listening"
          ? "granted"
          : prev.micPermission,
    }));
  }, []);

  const handlePartialResult = useCallback((chunk: TranscriptChunk) => {
    latestPartialRef.current = chunk;
    if (partialTimerRef.current) clearTimeout(partialTimerRef.current);
    partialTimerRef.current = setTimeout(async () => {
      const c = latestPartialRef.current;
      if (!c) return;
      const dir = directionRef.current;
      const [fromLang, toLang] = dir === "he->ru" ? ["he", "ru"] : ["ru", "he"];
      let translated = "";
      try {
        translated = await translationRef.current.translate(c.text, fromLang, toLang);
      } catch { translated = ""; }
      // Only update if this partial is still the latest
      if (latestPartialRef.current !== c) return;
      const msg: SubtitleMessage = {
        id: PARTIAL_ID,
        original: c.text,
        translated,
        isFinal: false,
        timestamp: c.timestamp,
        direction: dir,
      };
      setState((prev) => {
        const existing = prev.messages.findIndex((m) => m.id === PARTIAL_ID);
        if (existing >= 0) {
          const updated = [...prev.messages];
          updated[existing] = msg;
          return { ...prev, pipelineStage: "speech_detected", messages: updated };
        }
        return { ...prev, pipelineStage: "speech_detected", messages: [...prev.messages, msg] };
      });
    }, 300);
  }, []);

  const handleFinalResult = useCallback(async (chunk: TranscriptChunk) => {
    if (partialTimerRef.current) {
      clearTimeout(partialTimerRef.current);
      partialTimerRef.current = null;
    }
    latestPartialRef.current = null;
    setState((prev) => ({
      ...prev,
      pipelineStage: "translating",
      messages: prev.messages.filter((m) => m.id !== PARTIAL_ID),
    }));
    const dir = directionRef.current;
    const [fromLang, toLang] = dir === "he->ru" ? ["he", "ru"] : ["ru", "he"];
    let translated: string;
    try {
      translated = await translationRef.current.translate(chunk.text, fromLang, toLang);
    } catch {
      translated = "[ошибка перевода]";
    }
    const msg: SubtitleMessage = {
      id: chunk.id,
      original: chunk.text,
      translated,
      isFinal: true,
      timestamp: chunk.timestamp,
      direction: dir,
    };
    setState((prev) => ({
      ...prev,
      pipelineStage: "translated",
      messages: [...prev.messages.filter((m) => m.id !== PARTIAL_ID), msg],
    }));
    sendToPopup(translated);
    setTimeout(() => {
      if (providerRef.current.getStatus() === "listening") {
        setState((prev) => ({ ...prev, pipelineStage: "listening" }));
      }
    }, 500);
  }, [sendToPopup]);

  const handleError = useCallback((error: Error) => {
    const msg = error.message.toLowerCase();
    const isDenied = msg.includes("denied") || msg.includes("permission");
    if (msg.includes("no-speech")) {
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

  const getLangForDirection = (dir: TranslationDirection) =>
    dir === "he->ru" ? "he-IL" : "ru-RU";

  const startSession = useCallback(async (dir?: TranslationDirection) => {
    const activeDir = dir ?? directionRef.current;
    directionRef.current = activeDir;
    setDirection(activeDir);
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
      await (providerRef.current.start as (lang?: string) => Promise<void>)(getLangForDirection(activeDir));
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
    setState((prev) => ({
      ...prev,
      phase: "stopped",
      pipelineStage: "idle",
      messages: prev.messages.filter((m) => m.isFinal),
    }));
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
    direction,
    startSession,
    stopSession,
    clearMessages,
    openPopup,
    isRunning: state.phase === "running" || state.phase === "starting",
    isStopping: state.phase === "stopping",
  };
}
