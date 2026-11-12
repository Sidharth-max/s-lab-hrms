import "server-only";
import { cookies } from "next/headers";
import { isLang, LANG_COOKIE, makeT, type Lang } from "./i18n";

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "en";
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: makeT(lang) };
}
