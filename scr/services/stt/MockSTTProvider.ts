import type { STTProvider, STTProviderEvents, STTStatus, TranscriptChunk } from "./types";

/**
 * MockSTTProvider — simulates Hebrew speech recognition for local demo.
 * No real microphone access. Emits scripted phrases on a timer.
 */

const MOCK_PHRASES = [
  "שלום, אני מתקשר בקשר לפגישה של מחר",
  "כן, בוודאי. באיזו שעה נוח לך?",
  "אני חושב שעשר בבוקר יהיה מושלם",
  "מצוין. נפגש במשרד ברוטשילד?",
  "כן, בדיוק. אני אביא את כל המסמכים",
];

export class MockSTTProvider implements STTProvider {
  readonly name = "mock";

  private status: STTStatus = "idle";
  private events: STTProviderEvents | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private phraseIndex = 0;
  private chunkCounter = 0;

  async initialize(events: STTProviderEvents): Promise<void> {
    this.events = events;
    this.setStatus("requesting_permission");

    // Simulate permission grant
    await new Promise((r) => setTimeout(r, 500));
    this.setStatus("ready");
  }

  async start(): Promise<void> {
    this.setStatus("listening");
    this.phraseIndex = 0;
    this.chunkCounter = 0;

    this.intervalId = setInterval(() => {
      if (this.phraseIndex >= MOCK_PHRASES.length) {
        // Loop back for continuous demo
        this.phraseIndex = 0;
      }

      const text = MOCK_PHRASES[this.phraseIndex];
      const id = `mock-${++this.chunkCounter}`;

      // Emit partial first
      const partial: TranscriptChunk = {
        id,
        text: text.slice(0, Math.floor(text.length * 0.6)),
        lang: "he",
        isFinal: false,
        timestamp: Date.now(),
      };
      this.setStatus("partial_result");
      this.events?.onPartialResult(partial);

      // Then final after delay
      setTimeout(() => {
        const final: TranscriptChunk = {
          id,
          text,
          lang: "he",
          isFinal: true,
          timestamp: Date.now(),
        };
        this.setStatus("final_result");
        this.events?.onFinalResult(final);

        // Back to listening
        setTimeout(() => {
          if (this.status !== "idle") {
            this.setStatus("listening");
          }
        }, 300);
      }, 800);

      this.phraseIndex++;
    }, 3500);
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.setStatus("ready");
  }

  dispose(): void {
    this.stop();
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
