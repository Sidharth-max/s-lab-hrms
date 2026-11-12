import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, getDevice } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const actor = await getActor();
  if (actor) redirect(actor.role === "EMPLOYEE" ? "/me" : "/dashboard");
  const device = await getDevice();
  const { t } = await getT();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">S-Lab HRMS</h1>
        <p className="muted">{t("Attendance and salary", "हाज़िरी और सैलरी")}</p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="muted">Choose language / भाषा चुनें</span>
        <LanguageSwitch />
      </div>
      <div className="card">
        <LoginForm />
      </div>
      <div className="flex flex-col items-center gap-2 text-sm">
        {device && (
          <Link href="/scan" className="btn-secondary w-full">
            {t("Back to face scan", "फ़ेस स्कैन पर वापस")} ({device.name})
          </Link>
        )}
        <a href="/download" className="text-[var(--brand)] underline">
          {t("Download Android app", "एंड्रॉइड ऐप डाउनलोड करें")}
        </a>
      </div>
    </main>
  );
}
