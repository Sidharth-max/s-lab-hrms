import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { apkDownloadUrl, latestApk } from "@/lib/release";

// The Android app calls this on start to decide whether to show the "new update" pop-up.
export async function GET() {
  const latest = await latestApk();
  return NextResponse.json(
    { latest, downloadUrl: `${env.appUrl.replace(/\/$/, "")}/download`, apkUrl: apkDownloadUrl() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
