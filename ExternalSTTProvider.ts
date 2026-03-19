import type { STTProvider, STTProviderEvents, STTStatus } from "./types";

/**
 * ExternalSTTProvider — empty scaffold for connecting a real STT API
 * (e.g. ElevenLabs Scribe, Google Cloud Speech, Deepgram, AssemblyAI).
 *
 * TODO: Implement when a specific provider is chosen.
 * Expected flow:
 *   1. initialize() — get API token via Lovable Cloud edge function
 *   2. start() — open WebSocket / stream microphone audio to API
 *   3. Receive partial/final transcripts, emit via events
 *   4. stop() / dispose() — close connection, release resources
 */

export class ExternalSTTProvider implements STTProvider {
  readonly name = "external";

  private status: STTStatus = "idle";
  private events: STTProviderEvents | null = null;

  async initialize(events: STTProviderEvents): Promise<void> {
    this.events = events;
    this.setStatus("error");
    events.onError(
      new Error(
        "ExternalSTTProvider не настроен. Подключите конкретный STT-провайдер (ElevenLabs, Google, Deepgram и т.д.) и реализуйте методы initialize/start/stop."
      )
    );
  }

  async start(): Promise<void> {
    this.events?.onError(new Error("Provider not configured"));
  }

  async stop(): Promise<void> {
    this.setStatus("idle");
  }

  dispose(): void {
    this.events = null;
    this.status = "idle";
  }

  getStatus(): STTStatus {
    return this.status;
  }

  private setStatus(s: STTStatus) {
    this.status = s;
    this.events?.onStatusChange(s);
  }
}
