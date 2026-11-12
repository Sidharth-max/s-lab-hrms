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
      <div className="text-center">
        <h1 className="text-2xl font-bold">S-Lab HRMS</h1>
        <p className="muted">Attendance and salary</p>
      </div>
      <div className="card">
        <LoginForm />
      </div>
      <div className="flex flex-col items-center gap-2 text-sm">
        {device && (
          <Link href="/scan" className="btn-secondary w-full">
            Back to face scan ({device.name})
          </Link>
        )}
        <a href="/download" className="text-[var(--brand)] underline">
          Download Android app
        </a>
      </div>
    </main>
  );
}
