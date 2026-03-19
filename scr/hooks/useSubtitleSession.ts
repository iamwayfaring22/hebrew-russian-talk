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
 * Orchestrates: mic permission → STT provider → translation → UI messages.
 * All state transitions are driven by real provider events, not timers.
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

  // Keep refs in sync
  useEffect(() => {
    providerRef.current = sttProvider;
  }, [sttProvider]);

  useEffect(() => {
    translationRef.current = translationService;
  }, [translationService]);

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
      } else if (status === "error") {
        // Permission might have been denied — we check in onError
      }
    },
    [updatePipeline]
  );

  const handlePartialResult = useCallback(
    async (chunk: TranscriptChunk) => {
      updatePipeline("speech_detected");

      // Translate partial (best-effort)
      let translated = "";
      try {
        translated = await translationRef.current.translate(chunk.text, "he", "ru");
      } catch {
        translated = "…";
      }

      const msg: SubtitleMessage = {
        id: chunk.id,
        original: chunk.text,
        translated,
        isFinal: false,
        timestamp: chunk.timestamp,
      };

      partialMapRef.current.set(chunk.id, msg);

      setState((prev) => {
        // Replace existing partial or add new
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

      // Return to listening after showing "translated" briefly
      setTimeout(() => {
        if (providerRef.current.getStatus() === "listening") {
          updatePipeline("listening");
        }
      }, 500);
    },
    [updatePipeline]
  );

  const handleError = useCallback((error: Error) => {
    const msg = error.message.toLowerCase();
    const isDenied = msg.includes("denied") || msg.includes("permission");
    const isNoSpeech = msg.includes("no-speech");

    // no-speech is diagnostic, not fatal — don't break pipeline
    if (isNoSpeech) {
      setState((prev) => ({
        ...prev,
        error: error.message,
        // Keep current pipelineStage (listening), don't set to error
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      pipelineStage: "error",
      error: error.message,
      micPermission: isDenied ? "denied" : prev.micPermission,
    }));
  }, []);

  // --- Public API ---

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
      // ignore stop errors
    }

    setState((prev) => ({
      ...prev,
      phase: "stopped",
      pipelineStage: "idle",
      // Keep messages visible until manual reset
    }));
  }, []);

  const clearMessages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
      startedAt: null,
    }));
    partialMapRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      providerRef.current.dispose();
    };
  }, []);

  return {
    state,
    startSession,
    stopSession,
    clearMessages,
    isRunning: state.phase === "running" || state.phase === "starting",
    isStopping: state.phase === "stopping",
  };
}
