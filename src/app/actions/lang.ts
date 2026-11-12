"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isLang, LANG_COOKIE } from "@/lib/i18n";

/** Switches the screen language and remembers it for the logged-in user. */
export async function setLanguage(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, {
    path: "/",
    sameSite: "lax",
    secure: env.secureCookies,
    maxAge: 60 * 60 * 24 * 365 * 5,
  });
  const actor = await getActor();
  if (actor) await db.user.update({ where: { id: actor.id }, data: { language: lang } });
  revalidatePath("/", "layout");
}
