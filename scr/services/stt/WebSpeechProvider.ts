import type { STTProvider, STTProviderEvents, STTStatus, TranscriptChunk } from "./types";

/**
 * WebSpeechProvider
 *
 * Strategy that works on BOTH desktop and Android Chrome:
 *   - continuous = false  (browser cuts each utterance into segments ~3-5s)
 *   - interimResults = true  (show live text while speaking)
 *   - onend -> immediately restart if not stopped (Google Translate pattern)
 *
 * This gives real-time output on Android without duplicate rows.
 */
export class WebSpeechProvider implements STTProvider {
  readonly name = "web-speech";

  private status: STTStatus = "idle";
  private events: STTProviderEvents | null = null;
  private SpeechRecognitionClass: any = null;
  private recognition: any = null;
  private chunkCounter = 0;
  private _stopped = false;

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

  async start(): Promise<void> {
    if (!this.SpeechRecognitionClass) {
      this.events?.onError(new Error("Provider not initialized"));
      return;
    }
    this._stopped = false;
    this.setStatus("listening");
    this._startRecognition();
  }

  private _startRecognition() {
    if (this._stopped) return;

    const rec = new this.SpeechRecognitionClass();
    this.recognition = rec;

    rec.lang = "he-IL";
    rec.interimResults = true;   // show live partial text
    rec.continuous = false;      // browser auto-segments: fires onend after each phrase
    rec.maxAlternatives = 1;

    // Track the partial id for this utterance - stable within one segment
    const partialId = `ws-p-${++this.chunkCounter}`;
    let hasFinal = false;

    rec.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;

        if (result.isFinal) {
          hasFinal = true;
          const chunk: TranscriptChunk = {
            id: `ws-f-${this.chunkCounter}`,
            text,
            lang: "he",
            isFinal: true,
            timestamp: Date.now(),
          };
          this.setStatus("final_result");
          this.events?.onFinalResult(chunk);
        } else {
          // Partial: always use same partialId so hook updates in-place
          const chunk: TranscriptChunk = {
            id: partialId,
            text,
            lang: "he",
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
      // Immediately restart for the next segment — Google Translate pattern
      if (!this._stopped) {
        this.setStatus("listening");
        // Small delay avoids rapid-fire restart crashes on some Android versions
        setTimeout(() => {
          if (!this._stopped) this._startRecognition();
        }, 100);
      }
    };

    try {
      rec.start();
    } catch {
      // ignore already-started
    }
  }

  async stop(): Promise<void> {
    this._stopped = true;
    this.setStatus("ready");
    try {
      this.recognition?.stop();
    } catch { /* ignore */ }
    this.recognition = null;
  }

  dispose(): void {
    this._stopped = true;
    try {
      this.recognition?.stop();
    } catch { /* ignore */ }
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
