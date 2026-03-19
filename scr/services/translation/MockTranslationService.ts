import type { TranslationService } from "../stt/types";

/**
 * Mock translation service — returns pre-defined Hebrew-to-Russian translations.
 * Used for local demo when no real translation API is connected.
 */

const MOCK_TRANSLATIONS: Record<string, string> = {
  "שלום, אני מתקשר בקשר לפגישה של מחר": "Здравствуйте, я звоню по поводу завтрашней встречи",
  "כן, בוודאי. באיזו שעה נוח לך?": "Да, конечно. Во сколько вам удобно?",
  "אני חושב שעשר בבוקר יהיה מושלם": "Думаю, десять утра будет идеально",
  "מצוין. נפגש במשרד ברוטשילד?": "Отлично. Встречаемся в офисе на Ротшильд?",
  "כן, בדיוק. אני אביא את כל המסמכים": "Да, именно. Я принесу все документы",
};

export class MockTranslationService implements TranslationService {
  readonly name = "mock";

  async translate(text: string, _from: string, _to: string): Promise<string> {
    // Check exact match first
    if (MOCK_TRANSLATIONS[text]) {
      return MOCK_TRANSLATIONS[text];
    }

    // Check partial match (for partial results)
    for (const [key, value] of Object.entries(MOCK_TRANSLATIONS)) {
      if (key.startsWith(text)) {
        // Return proportional partial translation
        const ratio = text.length / key.length;
        return value.slice(0, Math.ceil(value.length * ratio)) + "…";
      }
    }

    // Simulate delay for unknown text
    await new Promise((r) => setTimeout(r, 200));
    return `[перевод: ${text}]`;
  }

  dispose(): void {
    // nothing to clean up
  }
}
