import type { CapacitorConfig } from "@capacitor/cli";

// The Android app is a thin shell around the website, so web updates reach the app instantly.
// APP_URL is set by the GitHub Actions build (defaults to the production site).
const appUrl = process.env.APP_URL || "https://hrms.s-lab.dev";

const config: CapacitorConfig = {
  appId: "dev.slab.hrms",
  appName: "S-Lab HRMS",
  webDir: "android-web",
  server: {
    url: appUrl,
    cleartext: appUrl.startsWith("http://"),
    errorPath: "offline.html",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
