import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, getDevice } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const actor = await getActor();
  if (actor) redirect(actor.role === "EMPLOYEE" ? "/me" : "/dashboard");
  const device = await getDevice();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-4">
      <div className="flex flex-col gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand)] text-lg font-bold text-white">S</span>
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em]">Log in to S-Lab HRMS</h1>
          <p className="mt-1 text-[15px] text-[var(--muted)]">Attendance and salary for your business.</p>
        </div>
      </div>
      <LoginForm />
      <div className="flex flex-col items-start gap-2 border-t border-[var(--line)] pt-4 text-sm">
        {device && (
          <Link href="/scan" className="btn-secondary w-full">
            {"Back to face scan"} ({device.name})
          </Link>
        )}
        <a href="/download" className="link">
          {"Download Android app"}
        </a>
      </div>
    </main>
  );
}
