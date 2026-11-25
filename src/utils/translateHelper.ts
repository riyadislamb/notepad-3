export interface TranslateLanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
}

export const TRANSLATE_LANGUAGES: TranslateLanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
];

function detectSourceLang(text: string, targetLang: string): string {
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (targetLang === 'en') return 'bn';
  return 'en';
}

async function translateViaGooglePublic(text: string, targetLang: string): Promise<string | null> {
  try {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
        targetLang
      )}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
    const joined = data[0]
      .map((part: unknown) => (Array.isArray(part) && typeof part[0] === 'string' ? part[0] : ''))
      .join('')
      .trim();
    return joined || null;
  } catch {
    return null;
  }
}

async function translateViaMyMemory(text: string, targetLang: string): Promise<string | null> {
  try {
    const sourceLang = detectSourceLang(text, targetLang);
    if (sourceLang === targetLang) return text;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text
    )}&langpair=${encodeURIComponent(`${sourceLang}|${targetLang}`)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      responseStatus?: number;
      responseData?: { translatedText?: string; match?: number };
      matches?: Array<{ translation?: string; quality?: string | number; match?: number }>;
    };
    if (data.responseStatus !== 200) return null;

    let best = data.responseData?.translatedText?.trim() || '';
    if (Array.isArray(data.matches) && data.matches.length > 0) {
      const sorted = [...data.matches]
        .filter((m) => m.translation && m.translation.trim().length > 0)
        .sort((a, b) => Number(b.quality || 0) - Number(a.quality || 0));
      if (sorted[0]?.translation && (data.responseData?.match ?? 0) < 0.85) {
        best = sorted[0].translation.trim();
      }
    }
    return best || null;
  } catch {
    return null;
  }
}

export async function translateText(text: string, targetLang: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const primary = await translateViaGooglePublic(trimmed, targetLang);
  if (primary) return primary;

  const fallback = await translateViaMyMemory(trimmed, targetLang);
  if (fallback) return fallback;

  throw new Error('Translation unavailable');
}
