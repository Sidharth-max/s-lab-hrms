import type { Metadata } from "next";
import Link from "next/link";
import { latestApk } from "@/lib/release";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Get the Android app · S-Lab HRMS" };

// Download page for the Android app. The links used to point straight at the APK file, which gave
// no feedback and no help when Android refused to install it. The usual reason: while the release
// signing key is not set up in GitHub, every build is signed with a new throwaway debug key, and
// Android will not install it over the existing app ("App not installed"). This page says so.
export default async function GetApp() {
  const latest = await latestApk();
  const mb = latest?.size ? `${Math.round(latest.size / 1048576)} MB` : null;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-5 pt-[calc(2rem+env(safe-area-inset-top))]">
      <div className="hero flex flex-col gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={64} height={64} className="rounded-2xl shadow-lg" />
        <h1 className="text-2xl font-bold tracking-tight">S-Lab HRMS for Android</h1>
        <p className="text-white/85">{latest ? `Version ${latest.versionName}${mb ? ` · ${mb}` : ""}` : "Latest version"}</p>
        <a href="/download" className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 font-semibold text-[#4a3cff] transition active:scale-95">Download the app</a>
      </div>
      {latest?.testBuild && (
        <div className="rounded-[18px] p-4 text-sm" style={{ background: "var(--tint-amber)", color: "var(--ink-amber)" }}>
          <b>Already have the app?</b> Uninstall it first. This build is a test build (signed with a temporary key), and Android will say
          “App not installed” if an older copy is on the phone. Your data is on the server, nothing is lost.
        </div>
      )}
      <ol className="card flex list-decimal flex-col gap-2 pl-9 text-sm">
        <li>Tap <b>Download the app</b> and wait for it to finish ({mb ?? "about 60 MB"}).</li>
        <li>Open the downloaded file from the notification or the Files app.</li>
        <li>If asked, allow your browser to <b>install unknown apps</b>, then go back and tap <b>Install</b>.</li>
        <li>Open S-Lab HRMS and log in with your mobile number.</li>
      </ol>
      <p className="muted text-center text-sm">
        Or use it in the browser: <Link className="link" href="/login">open the website</Link>.
      </p>
    </main>
  );
}
