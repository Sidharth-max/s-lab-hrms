import { createReadStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { apkDownloadUrl, latestApk } from "@/lib/release";

export const dynamic = "force-dynamic";

// "Download Android app" link. The newest APK built by GitHub Actions is kept on this server
// (APK_DIR, a Docker volume) and served from hrms.s-lab.dev itself, with resume support, so phones
// never depend on GitHub's file servers. A new release is fetched once, the first time it is requested.
const APK_DIR = process.env.APK_DIR ?? "/data/apk";
let fetching: Promise<string | null> | null = null;

async function localApk(version: number) {
  const file = path.join(APK_DIR, `s-lab-hrms-v${version}.apk`);
  try {
    const s = await stat(file);
    if (s.size > 1_000_000) return file;
  } catch {}
  return null;
}

async function fetchRelease(version: number): Promise<string | null> {
  const final = path.join(APK_DIR, `s-lab-hrms-v${version}.apk`);
  const part = `${final}.part`;
  try {
    await mkdir(APK_DIR, { recursive: true });
    const res = await fetch(apkDownloadUrl(), { redirect: "follow", cache: "no-store" });
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1_000_000 || buf.subarray(0, 2).toString() !== "PK") throw new Error("not an APK");
    await writeFile(part, buf);
    await rename(part, final);
    for (const f of await readdir(APK_DIR)) {
      if (f.endsWith(".apk") && f !== path.basename(final)) await rm(path.join(APK_DIR, f), { force: true });
    }
    return final;
  } catch (e) {
    console.error("Could not store the APK locally", e);
    await rm(part, { force: true }).catch(() => {});
    return null;
  }
}

async function ensureApk(version: number) {
  const have = await localApk(version);
  if (have) return have;
  fetching ??= fetchRelease(version).finally(() => {
    fetching = null;
  });
  return fetching;
}

function serve(file: string, size: number, range: string | null) {
  const headers = new Headers({
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Disposition": 'attachment; filename="s-lab-hrms.apk"',
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  });
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (m && (m[1] || m[2])) {
    if (m[1]) {
      start = Number(m[1]);
      if (m[2]) end = Math.min(Number(m[2]), size - 1);
    } else {
      start = Math.max(size - Number(m[2]), 0);
    }
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    status = 206;
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  headers.set("Content-Length", String(end - start + 1));
  // Phones often cancel or resume downloads; the stream must tolerate being closed at any moment.
  const source = createReadStream(file, { start, end });
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      source.on("data", (chunk) => {
        try {
          controller.enqueue(new Uint8Array(chunk as Buffer));
          if ((controller.desiredSize ?? 1) <= 0) source.pause();
        } catch {
          source.destroy();
        }
      });
      source.on("end", () => {
        try {
          controller.close();
        } catch {}
      });
      source.on("error", (e) => {
        try {
          controller.error(e);
        } catch {}
      });
    },
    pull() {
      source.resume();
    },
    cancel() {
      source.destroy();
    },
  });
  return new Response(body, { status, headers });
}

export async function GET(req: NextRequest) {
  const latest = await latestApk();
  if (latest) {
    const file = await ensureApk(latest.versionCode);
    if (file) return serve(file, (await stat(file)).size, req.headers.get("range"));
  }
  return NextResponse.redirect(apkDownloadUrl(), 302);
}
