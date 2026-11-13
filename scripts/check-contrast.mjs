// Checks that every coloured text ("ink") colour passes WCAG AA (4.5:1) on its card and page colours,
// in light and dark themes, for the app (mobile/src/lib/theme.ts) and the website (src/app/globals.css).
// Usage: node scripts/check-contrast.mjs
import { readFileSync } from "node:fs";

const lum = (hex) => {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

let failed = 0;
function check(label, inks, backgrounds) {
  for (const [name, fg] of Object.entries(inks)) {
    for (const [bgName, bg] of Object.entries(backgrounds)) {
      const r = ratio(fg, bg);
      const ok = r >= 4.5;
      if (!ok) failed++;
      console.log(`${ok ? "ok  " : "FAIL"} ${label.padEnd(10)} ${name.padEnd(8)} ${fg} on ${bgName.padEnd(5)} ${bg}  ${r.toFixed(2)}:1`);
    }
  }
}

// App theme: pull the two palette objects out of the TypeScript source.
const ts = readFileSync(new URL("../mobile/src/lib/theme.ts", import.meta.url), "utf8");
for (const theme of ["light", "dark"]) {
  const block = ts.slice(ts.indexOf(`const ${theme}`), ts.indexOf("};", ts.indexOf(`const ${theme}`)));
  const get = (k) => new RegExp(`\\b${k}: "(#[0-9a-f]{6})"`).exec(block)[1];
  const inkBlock = block.slice(block.indexOf("ink: {"), block.indexOf("}", block.indexOf("ink: {")));
  const tintBlock = block.slice(block.indexOf("tint: {"), block.indexOf("}", block.indexOf("tint: {")));
  const inks = Object.fromEntries([...inkBlock.matchAll(/(\w+): "(#[0-9a-f]{6})"/g)].map((m) => [m[1], m[2]]));
  const tints = Object.fromEntries([...tintBlock.matchAll(/(\w+): "(#[0-9a-f]{6})"/g)].map((m) => [m[1], m[2]]));
  check(`app ${theme}`, { ...inks, muted: get("muted"), brand: get("brandInk") }, { card: get("card"), page: get("bg") });
  // Ink on its own soft tint (chips).
  for (const k of Object.keys(inks)) check(`app ${theme}`, { [k]: inks[k] }, { tint: tints[k] });
}

// Website: --ink-* variables in :root and [data-theme="dark"].
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
for (const [theme, start] of [["light", css.indexOf(":root")], ["dark", css.indexOf('[data-theme="dark"]')]]) {
  const block = css.slice(start, css.indexOf("}", start));
  const v = (k) => new RegExp(`--${k}:\\s*(#[0-9a-f]{6})`).exec(block)?.[1];
  const inks = Object.fromEntries([...block.matchAll(/--ink-(\w+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
  if (Object.keys(inks).length) check(`web ${theme}`, { ...inks, muted: v("muted") }, { card: v("card"), page: v("bg") });
}

console.log(failed ? `\n${failed} combination(s) below 4.5:1` : "\nAll text colours pass WCAG AA (4.5:1).");
process.exit(failed ? 1 : 0);
