import type { STTProvider, STTProviderEvents, STTStatus, TranscriptChunk } from "./types";

export class WebSpeechProvider implements STTProvider {
  readonly name = "web-speech";

  private status: STTStatus = "idle";
  private events: STTProviderEvents | null = null;
  private SpeechRecognitionClass: any = null;
  private recognition: any = null;
  private chunkCounter = 0;
  private _stopped = false;
  private _lang = "he-IL"; // current recognition language

  async initialize(events: STTProviderEvents): Promise<void> {
    this.events = events;
    this._stopped = false;

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SR) {
      this.setStatus("error");
      events.onError(new Error("Web Speech API not supported in this browser"));
      return;
    }
    this.SpeechRecognitionClass = SR;

    this.setStatus("requesting_permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      this.setStatus("error");
      events.onError(new Error("Microphone permission denied"));
      return;
    }

    this.setStatus("ready");
  }

  // lang: "he-IL" | "ru-RU" (or any BCP-47 tag)
  async start(lang = "he-IL"): Promise<void> {
    if (!this.SpeechRecognitionClass) {
      this.events?.onError(new Error("Provider not initialized"));
      return;
    }
    this._stopped = false;
    this._lang = lang;
    this.setStatus("listening");
    this._startRecognition();
  }

  private _startRecognition() {
    if (this._stopped) return;

    const rec = new this.SpeechRecognitionClass();
    this.recognition = rec;

    rec.lang = this._lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    const partialId = `ws-p-${++this.chunkCounter}`;

    rec.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;

        if (result.isFinal) {
          const chunk: TranscriptChunk = {
            id: `ws-f-${this.chunkCounter}`,
            text,
            lang: this._lang.split("-")[0], // "he" or "ru"
            isFinal: true,
            timestamp: Date.now(),
          };
          this.setStatus("final_result");
          this.events?.onFinalResult(chunk);
        } else {
          const chunk: TranscriptChunk = {
            id: partialId,
            text,
            lang: this._lang.split("-")[0],
            isFinal: false,
            timestamp: Date.now(),
          };
          this.setStatus("partial_result");
          this.events?.onPartialResult(chunk);
        }
      }
    };

    rec.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      this.setStatus("error");
      this.events?.onError(new Error(`Speech recognition error: ${event.error}`));
    };

    rec.onend = () => {
      if (!this._stopped) {
        this.setStatus("listening");
        setTimeout(() => {
          if (!this._stopped) this._startRecognition();
        }, 100);
      }
    };

    try {
      rec.start();
    } catch { /* ignore */ }
  }

  async stop(): Promise<void> {
    this._stopped = true;
    this.setStatus("ready");
    try { this.recognition?.stop(); } catch { /* ignore */ }
    this.recognition = null;
  }

  dispose(): void {
    this._stopped = true;
    try { this.recognition?.stop(); } catch { /* ignore */ }
    this.recognition = null;
    this.events = null;
    this.setStatus("idle");
  }

  getStatus(): STTStatus { return this.status; }

  private setStatus(s: STTStatus) {
    this.status = s;
    this.events?.onStatusChange(s);
  }
}
