import { NextResponse } from "next/server";
import { apkDownloadUrl } from "@/lib/release";

// "Download Android app" link: always the newest APK built by GitHub Actions.
export function GET() {
  return NextResponse.redirect(apkDownloadUrl(), 302);
}
