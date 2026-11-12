import "server-only";
import { env } from "./env";

// The Android APK is built by GitHub Actions and attached to a GitHub Release
// tagged "apk-v<versionCode>". The website's /download link always points to the newest one.

export const APK_ASSET = "s-lab-hrms.apk";

export function apkDownloadUrl() {
  return `https://github.com/${env.githubRepo}/releases/latest/download/${APK_ASSET}`;
}

let cache: { at: number; value: { versionCode: number; versionName: string; publishedAt: string | null } | null } | null = null;

export async function latestApk() {
  if (cache && Date.now() - cache.at < 5 * 60000) return cache.value;
  let value: { versionCode: number; versionName: string; publishedAt: string | null } | null = null;
  try {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "s-lab-hrms" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const res = await fetch(`https://api.github.com/repos/${env.githubRepo}/releases/latest`, { headers, cache: "no-store" });
    if (res.ok) {
      const r = (await res.json()) as { tag_name?: string; name?: string; published_at?: string };
      const m = /^apk-v(\d+)$/.exec(r.tag_name ?? "");
      if (m) value = { versionCode: Number(m[1]), versionName: r.name ?? r.tag_name!, publishedAt: r.published_at ?? null };
    }
  } catch (e) {
    console.error("Could not read latest release", e);
  }
  cache = { at: Date.now(), value };
  return value;
}
