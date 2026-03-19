/**
 * Core types for the STT pipeline and translation system.
 * "Акустический субтитратор звонка" — Limes architecture types.
 */

// --- STT Provider Status ---

export type STTStatus =
  | "idle"
  | "requesting_permission"
  | "ready"
  | "listening"
  | "partial_result"
  | "final_result"
  | "error";

// --- Pipeline Status (UI-facing) ---

export type PipelineStage =
  | "idle"
  | "requesting_permission"
  | "mic_ready"
  | "listening"
  | "speech_detected"
  | "translating"
  | "translated"
  | "error";

// --- Transcript & Translation chunks ---

export interface TranscriptChunk {
  id: string;
  text: string;
  lang: "he";
  isFinal: boolean;
  timestamp: number;
}

export interface TranslationChunk {
  id: string;
  sourceId: string; // links to TranscriptChunk.id
  original: string;
  translated: string;
  isFinal: boolean;
  timestamp: number;
}

// --- Subtitle message for the UI feed ---

export interface SubtitleMessage {
  id: string;
  original: string;       // Hebrew text
  translated: string;     // Russian translation
  isFinal: boolean;       // partial vs final
  timestamp: number;
}

// --- Session State ---

export type SessionPhase =
  | "stopped"
  | "starting"
  | "running"
  | "stopping";

export interface SessionState {
  phase: SessionPhase;
  pipelineStage: PipelineStage;
  messages: SubtitleMessage[];
  error: string | null;
  startedAt: number | null;
  micPermission: "unknown" | "granted" | "denied";
}

// --- STT Provider interface ---

export interface STTProviderEvents {
  onPartialResult: (chunk: TranscriptChunk) => void;
  onFinalResult: (chunk: TranscriptChunk) => void;
  onError: (error: Error) => void;
  onStatusChange: (status: STTStatus) => void;
}

export interface STTProvider {
  readonly name: string;

  initialize(events: STTProviderEvents): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): void;
  getStatus(): STTStatus;
}

// --- Translation Service interface ---

export interface TranslationService {
  readonly name: string;

  translate(text: string, from: string, to: string): Promise<string>;
  dispose(): void;
}
