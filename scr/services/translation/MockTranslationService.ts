import type { TranslationService } from "../stt/types";

/**
 * GoogleTranslationService - uses unofficial Google Translate API.
 * No API key required. Works directly from browser.
 */
export class MockTranslationService implements TranslationService {
  readonly name = "google";

  private cache = new Map<string, string>();

  async translate(text: string, _from: string, _to: string): Promise<string> {
    if (!text.trim()) return "";

    const cacheKey = `${_from}|${_to}|${text}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const url =
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${_from}&tl=${_to}&dt=t&q=` +
        encodeURIComponent(text);

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      // Response format: [[["translated", "original", ...], ...], ...]
      const translated: string = data[0]
        .map((chunk: any[]) => chunk[0] ?? "")
        .join("");

      this.cache.set(cacheKey, translated);
      return translated;
    } catch (err) {
      console.warn("Translation failed:", err);
      return text; // fallback: show original
    }
  }

  dispose(): void {
    this.cache.clear();
  }
}
