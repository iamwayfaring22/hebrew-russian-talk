import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SessionState,
  PipelineStage,
  STTProvider,
  STTStatus,
  TranscriptChunk,
  SubtitleMessage,
  TranslationService,
} from "@/services/stt/types";

/**
 * useSubtitleSession — state manager for the subtitle pipeline.
 * Partial results: shown immediately WITHOUT translation (no UI freeze).
 * Final results: translated async, then displayed.
 */
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
  const partialMapRef = useRef<Map<string, SubtitleMessage>>(new Map());
  // popup window ref
  const popupRef = useRef<Window | null>(null);

  useEffect(() => { providerRef.current = sttProvider; }, [sttProvider]);
  useEffect(() => { translationRef.current = translationService; }, [translationService]);

  // Send translation to popup window if open
  const sendToPopup = useCallback((text: string, isFinal: boolean) => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.postMessage({ type: "TRANSLATION", text, isFinal }, "*");
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
      "width=480,height=280,top=50,left=50,resizable=yes,scrollbars=yes"
    );
    popupRef.current = w;
  }, []);

  const updatePipeline = useCallback((stage: PipelineStage) => {
    setState((prev) => ({ ...prev, pipelineStage: stage }));
  }, []);

  const handleStatusChange = useCallback(
    (status: STTStatus) => {
      const stage = STT_TO_PIPELINE[status];
      updatePipeline(stage);
      if (status === "requesting_permission") {
        setState((prev) => ({ ...prev, micPermission: "unknown" }));
      } else if (status === "ready" || status === "listening") {
        setState((prev) => ({ ...prev, micPermission: "granted" }));
      }
    },
    [updatePipeline]
  );

  // PARTIAL: show original immediately, NO translation fetch
  const handlePartialResult = useCallback(
    (chunk: TranscriptChunk) => {
      updatePipeline("speech_detected");
      const msg: SubtitleMessage = {
        id: chunk.id,
        original: chunk.text,
        translated: "", // will be filled on final
        isFinal: false,
        timestamp: chunk.timestamp,
      };
      partialMapRef.current.set(chunk.id, msg);
      setState((prev) => {
        const existing = prev.messages.findIndex((m) => m.id === chunk.id);
        if (existing >= 0) {
          const updated = [...prev.messages];
          updated[existing] = msg;
          return { ...prev, messages: updated };
        }
        return { ...prev, messages: [...prev.messages, msg] };
      });
    },
    [updatePipeline]
  );

  // FINAL: translate once, update message
  const handleFinalResult = useCallback(
    async (chunk: TranscriptChunk) => {
      updatePipeline("translating");
      let translated: string;
      try {
        translated = await translationRef.current.translate(chunk.text, "he", "ru");
      } catch {
        translated = "[ошибка перевода]";
      }
      updatePipeline("translated");
      const msg: SubtitleMessage = {
        id: chunk.id,
        original: chunk.text,
        translated,
        isFinal: true,
        timestamp: chunk.timestamp,
      };
      partialMapRef.current.delete(chunk.id);
      setState((prev) => {
        const existing = prev.messages.findIndex((m) => m.id === chunk.id);
        if (existing >= 0) {
          const updated = [...prev.messages];
          updated[existing] = msg;
          return { ...prev, messages: updated };
        }
        return { ...prev, messages: [...prev.messages, msg] };
      });
      sendToPopup(translated, true);
      setTimeout(() => {
        if (providerRef.current.getStatus() === "listening") {
          updatePipeline("listening");
        }
      }, 500);
    },
    [updatePipeline, sendToPopup]
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
    partialMapRef.current.clear();
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
    setState((prev) => ({ ...prev, phase: "stopping" }));
    try {
      await providerRef.current.stop();
    } catch {
      // ignore
    }
    setState((prev) => ({
      ...prev,
      phase: "stopped",
      pipelineStage: "idle",
    }));
  }, []);

  const clearMessages = useCallback(() => {
    setState((prev) => ({ ...prev, messages: [], startedAt: null }));
    partialMapRef.current.clear();
  }, []);

  useEffect(() => {
    return () => { providerRef.current.dispose(); };
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
