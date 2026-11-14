import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, getDevice } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const actor = await getActor();
  if (actor) redirect(actor.role === "EMPLOYEE" ? "/me" : "/dashboard");
  const device = await getDevice();

  return (
    <main className="min-h-dvh bg-[var(--bg)]">
      {/* Gradient hero with the logo (same look as the app's login and the Today screen). */}
      <div className="hero !rounded-none !rounded-b-[36px] px-6 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-20 text-center">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3.5">
          <span className="rounded-[26px] bg-white/20 p-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- small static logo, same file as the app icon */}
            <img src="/logo.png" alt="S-Lab HRMS logo" width={84} height={84} className="h-[84px] w-[84px] rounded-[22px]" />
          </span>
          <div>
            <h1 className="text-[30px] font-bold leading-tight tracking-[-0.03em]">S-Lab HRMS</h1>
            <p className="mt-1 text-[15px] text-white/85">Face attendance and salary for your business</p>
          </div>
        </div>
      </div>
      <div className="mx-auto -mt-12 flex max-w-sm flex-col gap-4 px-4 pb-8">
        <div className="card !rounded-[28px] !p-5 shadow-[0_10px_30px_rgba(15,23,42,0.10)]">
          <h2 className="text-[22px] font-bold tracking-[-0.02em]">Log in</h2>
          <p className="muted mb-4">We will send a 6 digit code by SMS.</p>
          <LoginForm />
        </div>
        <div className="flex flex-col items-center gap-2 text-sm">
          {device && (
            <Link href="/scan" className="btn-secondary w-full">
              {"Back to face scan"} ({device.name})
            </Link>
          )}
          <a href="/get-app" className="link">
            {"Download Android app"}
          </a>
        </div>
      </div>
    </main>
  );
}
