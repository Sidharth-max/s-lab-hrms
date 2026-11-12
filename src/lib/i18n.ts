// Hindi / English. Text is written inline as t("English", "हिंदी") so both stay side by side.

export type Lang = "en" | "hi";
export const LANG_COOKIE = "hrms_lang";
export type T = (en: string, hi: string) => string;

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "hi";
}

export function makeT(lang: Lang): T {
  return (en, hi) => (lang === "hi" ? hi : en);
}

export const LOCALE: Record<Lang, string> = { en: "en-IN", hi: "hi-IN" };
