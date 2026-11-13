import { NextResponse } from "next/server";
import { apkDownloadUrl } from "@/lib/release";

export const dynamic = "force-dynamic";

// "Download Android app" link: always the newest APK built by GitHub Actions.
// The file is streamed through this site (instead of redirecting to GitHub) so it downloads
// from hrms.s-lab.dev even where GitHub's file servers are blocked or the in-app browser
// cannot follow the redirect. If GitHub cannot be reached it falls back to a plain redirect.
export async function GET() {
  const url = apkDownloadUrl();
  try {
    const upstream = await fetch(url, { redirect: "follow", cache: "no-store" });
    if (!upstream.ok || !upstream.body) throw new Error(`GitHub answered ${upstream.status}`);
    const headers = new Headers({
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="s-lab-hrms.apk"',
      "Cache-Control": "no-store",
    });
    const length = upstream.headers.get("content-length");
    if (length) headers.set("Content-Length", length);
    return new Response(upstream.body, { status: 200, headers });
  } catch (e) {
    console.error("APK proxy failed, redirecting to GitHub", e);
    return NextResponse.redirect(url, 302);
  }
}
