import type { STTProvider, STTProviderEvents, STTStatus, TranscriptChunk } from "./types";

export class WebSpeechProvider implements STTProvider {
  readonly name = "web-speech";

  private status: STTStatus = "idle";
  private events: STTProviderEvents | null = null;
  private recognition: any = null;
  private chunkCounter = 0;
  // Flag: true while we intentionally want to be stopped
  private _stopped = false;

  async initialize(events: STTProviderEvents): Promise<void> {
    this.events = events;
    this._stopped = false;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.setStatus("error");
      events.onError(new Error("Web Speech API not supported in this browser"));
      return;
    }

    this.setStatus("requesting_permission");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      this.setStatus("error");
      events.onError(new Error("Microphone permission denied"));
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = "he-IL";
    this.recognition.interimResults = true;
    this.recognition.continuous = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: any) => {
      // Only process the single result at resultIndex — never re-process old ones
      const i = event.resultIndex;
      const result = event.results[i];
      if (!result) return;

      const text = result[0].transcript.trim();
      if (!text) return;

      // For partials: reuse the same counter so PARTIAL_ID logic in hook works
      // For finals: increment to get a unique id
      const id = result.isFinal
        ? `ws-${++this.chunkCounter}`
        : `ws-partial`;

      const chunk: TranscriptChunk = {
        id,
        text,
        lang: "he",
        isFinal: result.isFinal,
        timestamp: Date.now(),
      };

      if (result.isFinal) {
        this.setStatus("final_result");
        this.events?.onFinalResult(chunk);
        setTimeout(() => {
          if (!this._stopped && this.status !== "idle") {
            this.setStatus("listening");
          }
        }, 200);
      } else {
        this.setStatus("partial_result");
        this.events?.onPartialResult(chunk);
      }
    };

    this.recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        this.events?.onError(new Error("no-speech: речь не обнаружена. Проверьте громкую связь."));
        return;
      }
      if (event.error === "aborted") return; // triggered by our own stop()
      this.setStatus("error");
      this.events?.onError(new Error(`Speech recognition error: ${event.error}`));
    };

    this.recognition.onend = () => {
      // Auto-restart ONLY if we have NOT been told to stop
      if (!this._stopped && this.status !== "idle" && this.status !== "error") {
        try {
          this.recognition?.start();
        } catch {
          // already started
        }
      }
    };

    this.setStatus("ready");
  }

  async start(): Promise<void> {
    if (!this.recognition) {
      this.events?.onError(new Error("Provider not initialized"));
      return;
    }
    this._stopped = false;
    this.setStatus("listening");
    try {
      this.recognition.start();
    } catch {
      // may already be started
    }
  }

  async stop(): Promise<void> {
    // Set flag BEFORE calling stop() so onend doesn't restart
    this._stopped = true;
    this.setStatus("ready");
    try {
      this.recognition?.stop();
    } catch {
      // ignore
    }
  }

  dispose(): void {
    this._stopped = true;
    try {
      this.recognition?.stop();
    } catch {
      // ignore
    }
    this.recognition = null;
    this.events = null;
    this.setStatus("idle");
  }

  getStatus(): STTStatus {
    return this.status;
  }

  private setStatus(s: STTStatus) {
    this.status = s;
    this.events?.onStatusChange(s);
  }
}
