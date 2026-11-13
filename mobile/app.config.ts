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
  // Follows the phone's light / dark setting (the app also has its own choice in More).
  userInterfaceStyle: "automatic",
  backgroundColor: "#f3f4f7",
  android: {
    package: "dev.slab.hrms",
    versionCode,
    // Icon: face-scan frame with a check mark on the indigo-to-blue brand gradient (design/icon.svg).
    adaptiveIcon: {
      backgroundColor: "#4a3cff",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    // REQUEST_INSTALL_PACKAGES: the app downloads its own update and opens the installer.
    // VIBRATE: haptic feedback (expo-haptics also declares it; listed so it can never be dropped).
    permissions: ["android.permission.CAMERA", "android.permission.REQUEST_INSTALL_PACKAGES", "android.permission.VIBRATE"],
    // Android 13+ predictive back: sets android:enableOnBackInvokedCallback="true". The system shows
    // the back preview (back-to-home on Today, the previous screen inside the stack) while swiping.
    predictiveBackGestureEnabled: true,
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 180,
        resizeMode: "contain",
        backgroundColor: "#f3f4f7",
        dark: { image: "./assets/splash-icon.png", backgroundColor: "#0b0c10" },
      },
    ],
    "expo-secure-store",
    "expo-system-ui",
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
