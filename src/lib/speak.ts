"use client";

import { Capacitor } from "@capacitor/core";

/** Speaks Hindi text. Uses the phone's text-to-speech in the Android app, the browser voice on the web. */
export async function speakHindi(text: string) {
  try {
    if (Capacitor.isNativePlatform()) {
      const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
      await TextToSpeech.stop().catch(() => {});
      await TextToSpeech.speak({ text, lang: "hi-IN", rate: 0.95 });
      return;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "hi-IN";
      u.rate = 0.95;
      const hindi = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("hi"));
      if (hindi) u.voice = hindi;
      window.speechSynthesis.speak(u);
    }
  } catch {
    // Voice is a helper only; the screen always shows the same message.
  }
}

export function beep(ok: boolean) {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220;
    g.gain.value = 0.15;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.15 : 0.4));
  } catch {}
}
