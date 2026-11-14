// Tidy capitals for text people type in. "KULDEEP YOGENDRA SINGH" and "kuldeep yogendra singh" both
// become "Kuldeep Yogendra Singh". Pure functions (unit tested); also used once to fix saved data.

/** Small joining words kept lower case inside a title ("State Bank of India"). */
const SMALL = new Set(["of", "and", "the", "for", "in", "on", "at", "to", "by", "a", "an", "or"]);

const hasLower = (s: string) => s !== s.toUpperCase();
const hasUpper = (s: string) => s !== s.toLowerCase();

/**
 * Title Case for names, places and labels: each word starts with a capital, the rest small.
 * Kept as typed: words with digits ("2B", "E001"), mixed-case words ("McDonald", "iPhone"), and short
 * capital abbreviations ("GGU", "HQ") when the rest of the text is not all capitals.
 */
export function titleCase(input: string | null | undefined): string {
  const s = (input ?? "").replace(/\s+/g, " ").trim();
  if (!s) return s;
  const allCaps = !hasLower(s);
  let first = true;
  return s.replace(/[\p{L}\p{M}][\p{L}\p{M}\p{N}'’]*/gu, (word, offset: number) => {
    const isFirst = first;
    first = false;
    // Second part of a hyphenated or apostrophe word ("Singh-rathore", "O'neil") also starts with a capital.
    const prev = offset > 0 ? s[offset - 1] : " ";
    if (/\p{N}/u.test(word)) return word;
    const lower = word.toLowerCase();
    if (!allCaps && hasUpper(word) && !hasLower(word) && word.length <= 4) return word; // abbreviation
    if (hasUpper(word.slice(1)) && hasLower(word)) return word[0].toUpperCase() + word.slice(1); // McDonald
    if (!isFirst && prev === " " && SMALL.has(lower)) return lower;
    return lower[0].toUpperCase() + lower.slice(1);
  });
}

/**
 * Sentence case for notes and reasons: first letter capital. Text typed in all capitals (or all small)
 * is made small first, so "SALARY TILL DIWALI" becomes "Salary till diwali".
 */
export function sentenceCase(input: string | null | undefined): string {
  const s = (input ?? "").replace(/\s+/g, " ").trim();
  if (!s) return s;
  const base = !hasLower(s) ? s.toLowerCase() : s;
  return base.replace(/\p{L}/u, (c) => c.toUpperCase());
}

/** Same as sentenceCase but keeps null / empty as null (for optional notes). */
export function noteOrNull(input: string | null | undefined): string | null {
  const s = sentenceCase(input);
  return s ? s : null;
}
