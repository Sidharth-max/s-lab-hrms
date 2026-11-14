import type { MetadataRoute } from "next";

// Web app manifest: makes the website installable ("Add to Home screen" / "Install app") with its own
// window and the same purple logo as the Android app. Served at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "S-Lab HRMS",
    short_name: "S-Lab HRMS",
    description: "Face attendance and salary for your business",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f3f4f7",
    theme_color: "#4a3cff",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // The face-scan mark sits well inside the safe zone, so Android can crop it to any shape.
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today", url: "/dashboard", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96", type: "image/png" }] },
      { name: "Attendance", url: "/attendance", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96", type: "image/png" }] },
      { name: "Salary", url: "/salary", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96", type: "image/png" }] },
    ],
  };
}
