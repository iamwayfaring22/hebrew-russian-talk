import type { TranslationService } from "../stt/types";

/**
 * ExternalTranslationService — scaffold for connecting a real translation API.
 * 
 * TODO: Implement with one of:
 *   - Lovable Cloud edge function calling Google Translate API
 *   - Lovable Cloud edge function calling OpenAI GPT translation
 *   - Direct API call to LibreTranslate or similar
 * 
 * Expected: POST to edge function with { text, from: "he", to: "ru" }
 *           Returns { translated: "..." }
 */

export class ExternalTranslationService implements TranslationService {
  readonly name = "external";

  async translate(_text: string, _from: string, _to: string): Promise<string> {
    throw new Error(
      "ExternalTranslationService не настроен. Подключите API перевода через Lovable Cloud edge function."
    );
  }

  dispose(): void {
    // nothing to clean up
  }
}
