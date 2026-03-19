import type { STTProvider, STTProviderEvents, STTStatus, TranscriptChunk } from "./types";

// Detect Android Chrome — behaves differently with interimResults
const isAndroid = /Android/i.test(navigator.userAgent);

export class WebSpeechProvider implements STTProvider {
  readonly name = "web-speech";

  private status: STTStatus = "idle";
  private events: STTProviderEvents | null = null;
  private recognition: any = null;
  private chunkCounter = 0;
  private _stopped = false;
  // On Android we use a single stable partial id per session
  private _partialId = "ws-partial";

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
    // On Android interim results cause duplicate rows — disable them
    this.recognition.interimResults = !isAndroid;
    this.recognition.continuous = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: any) => {
      const i = event.resultIndex;
      const result = event.results[i];
      if (!result) return;

      const text = result[0].transcript.trim();
      if (!text) return;

      if (result.isFinal) {
        const id = `ws-${++this.chunkCounter}`;
        const chunk: TranscriptChunk = {
          id,
          text,
          lang: "he",
          isFinal: true,
          timestamp: Date.now(),
        };
        this.setStatus("final_result");
        this.events?.onFinalResult(chunk);
        setTimeout(() => {
          if (!this._stopped && this.status !== "idle") {
            this.setStatus("listening");
          }
        }, 200);
      } else {
        // Partial — always same id so the hook updates in-place
        const chunk: TranscriptChunk = {
          id: this._partialId,
          text,
          lang: "he",
          isFinal: false,
          timestamp: Date.now(),
        };
        this.setStatus("partial_result");
        this.events?.onPartialResult(chunk);
      }
    };

    this.recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        this.events?.onError(new Error("no-speech: речь не обнаружена. Проверьте громкую связь."));
        return;
      }
      if (event.error === "aborted") return;
      this.setStatus("error");
      this.events?.onError(new Error(`Speech recognition error: ${event.error}`));
    };

    this.recognition.onend = () => {
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
    this._partialId = `ws-partial-${Date.now()}`;
    this.setStatus("listening");
    try {
      this.recognition.start();
    } catch {
      // may already be started
    }
  }

  async stop(): Promise<void> {
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
