import type { STTProvider, STTProviderEvents, STTStatus, TranscriptChunk } from "./types";

/**
 * WebSpeechProvider — uses the browser's built-in Web Speech API.
 * Works in Chrome/Android WebView. Optional fallback, not the primary provider.
 * Language: Hebrew (he-IL).
 */

export class WebSpeechProvider implements STTProvider {
  readonly name = "web-speech";

  private status: STTStatus = "idle";
  private events: STTProviderEvents | null = null;
  private recognition: any = null;
  private chunkCounter = 0;

  async initialize(events: STTProviderEvents): Promise<void> {
    this.events = events;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.setStatus("error");
      events.onError(new Error("Web Speech API not supported in this browser"));
      return;
    }

    this.setStatus("requesting_permission");

    // Request microphone permission explicitly
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // release immediately
    } catch (err) {
      this.setStatus("error");
      events.onError(new Error("Microphone permission denied"));
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = "he-IL";
    this.recognition.interimResults = true;
    this.recognition.continuous = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        const id = `ws-${++this.chunkCounter}`;

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
            if (this.status !== "idle") this.setStatus("listening");
          }, 200);
        } else {
          this.setStatus("partial_result");
          this.events?.onPartialResult(chunk);
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        // Don't break the pipeline, but surface diagnostic
        this.events?.onError(new Error("no-speech: речь не обнаружена. Проверьте громкую связь."));
        return;
      }
      this.setStatus("error");
      this.events?.onError(new Error(`Speech recognition error: ${event.error}`));
    };

    this.recognition.onend = () => {
      // Auto-restart if we're supposed to be listening
      if (this.status === "listening" || this.status === "partial_result" || this.status === "final_result") {
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
    this.setStatus("listening");
    try {
      this.recognition.start();
    } catch {
      // may already be started
    }
  }

  async stop(): Promise<void> {
    try {
      this.recognition?.stop();
    } catch {
      // ignore
    }
    this.setStatus("ready");
  }

  dispose(): void {
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
