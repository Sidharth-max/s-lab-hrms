import type { ExpoConfig } from "expo/config";

// Native Android app for S-Lab HRMS. Talks to the server API (APP_URL) instead of loading the website.
// VERSION_CODE / VERSION_NAME are set by the GitHub Actions build.
const appUrl = process.env.APP_URL || "https://hrms.s-lab.dev";
const versionCode = Number(process.env.VERSION_CODE || "1");

const config: ExpoConfig = {
  name: "S-Lab HRMS",
  slug: "s-lab-hrms",
  scheme: "slabhrms",
  version: process.env.VERSION_NAME || "1.0.0",
  orientation: "default",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  backgroundColor: "#ffffff",
  android: {
    package: "dev.slab.hrms",
    versionCode,
    adaptiveIcon: {
      backgroundColor: "#171717",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    // REQUEST_INSTALL_PACKAGES: the app downloads its own update and opens the installer.
    permissions: ["android.permission.CAMERA", "android.permission.REQUEST_INSTALL_PACKAGES"],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-camera",
      {
        cameraPermission: "The camera is used to take face photos for attendance.",
        recordAudioAndroid: false,
        barcodeScannerEnabled: false,
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: { apiUrl: appUrl.replace(/\/$/, ""), versionCode },
};

export default config;
