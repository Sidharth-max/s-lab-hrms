// After `next build`: make the built CSS work on older Safari (iOS 14 / 15) and older browsers.
//
// Tailwind 4 and Next.js 16 write CSS for Safari 16.4+. On iOS 15.0–15.3 and older, everything inside
// @layer is ignored (most of the site lost its styling), color-mix() is unknown (backgrounds vanish),
// dvh units are unknown and the frosted header needs the -webkit- prefix. This step rewrites
// .next/static/**/*.css with:
//   - postcss-preset-env for the browsers in package.json: flattens cascade layers (keeping their
//     order of priority), adds vendor prefixes, gives oklab()/lab() colours rgb fallbacks;
//   - a fallback before each color-mix() when one can be worked out (see mixFallback);
//   - a vh fallback before each dvh / svh / lvh value.
//   - the standard backdrop-filter next to a lone -webkit-backdrop-filter.
// Newer browsers keep using the original declarations (they come last), so nothing changes for them.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import presetEnv from "postcss-preset-env";

const root = new URL("..", import.meta.url).pathname;
const browsers = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).browserslist;
const dir = join(root, ".next", "static");

function cssFiles(d) {
  let out = [];
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) out = out.concat(cssFiles(p));
    else if (name.endsWith(".css")) out.push(p);
  }
  return out;
}

/** Splits on top-level commas. */
function splitArgs(s) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Custom properties that have one value everywhere in the file (same in light and dark). */
function staticVars(rootNode) {
  const seen = new Map();
  rootNode.walkDecls(/^--/, (d) => {
    const v = d.value.trim();
    const list = seen.get(d.prop) ?? new Set();
    list.add(v);
    seen.set(d.prop, list);
  });
  const out = new Map();
  for (const [k, vals] of seen) if (vals.size === 1) out.set(k, [...vals][0]);
  return out;
}

/**
 * Fallback for one color-mix(): "in <space>, A p%, transparent" with a fixed colour A becomes
 * rgba(A, p); with a theme colour (var) and p >= 60% it becomes that colour (opaque); a mix of two
 * colours becomes the first. Otherwise no fallback (the property is simply skipped by old browsers).
 */
function mixFallback(inner, vars) {
  const args = splitArgs(inner);
  if (args.length < 3 || !/^in\s/.test(args[0])) return null;
  const m = args[1].match(/^(.*?)\s+([\d.]+)%$/);
  const color = (m ? m[1] : args[1]).trim();
  const pct = m ? Number(m[2]) : 50;
  if (/currentcolor/i.test(color)) return null;
  const resolved = color.replace(/^var\((--[\w-]+)\)$/, (_, v) => vars.get(v) ?? `var(${v})`);
  if (args[2] === "transparent") {
    const rgb = /^#[0-9a-f]{3,8}$/i.test(resolved) ? hexToRgb(resolved) : null;
    if (rgb) return `rgba(${rgb.join(", ")}, ${+(pct / 100).toFixed(3)})`;
    if (pct >= 60) return resolved;
    return null;
  }
  return resolved;
}

function replaceMixes(value, vars) {
  let out = "";
  let i = 0;
  while (i < value.length) {
    const at = value.indexOf("color-mix(", i);
    if (at < 0) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, at);
    let depth = 0;
    let j = at + "color-mix".length;
    for (; j < value.length; j++) {
      if (value[j] === "(") depth++;
      if (value[j] === ")" && --depth === 0) break;
    }
    const inner = value.slice(at + "color-mix(".length, j);
    const fb = mixFallback(inner, vars);
    if (fb === null) return null;
    out += fb;
    i = j + 1;
  }
  return out;
}

const fallbacks = (vars) => ({
  postcssPlugin: "hrms-legacy-fallbacks",
  Declaration(decl) {
    if (decl.prop.startsWith("--") || decl.__hrmsDone) return;
    const prev = decl.prev();
    // dvh / svh / lvh -> vh
    if (/\d(dvh|svh|lvh)\b/.test(decl.value)) {
      const v = decl.value.replace(/(\d)(dvh|svh|lvh)\b/g, "$1vh");
      if (!(prev && prev.type === "decl" && prev.prop === decl.prop && prev.value === v)) decl.cloneBefore({ value: v }).__hrmsDone = true;
    }
    if (decl.value.includes("color-mix(") && !/shadow/.test(decl.prop)) {
      const v = replaceMixes(decl.value, vars);
      const hasFallback = prev && prev.type === "decl" && prev.prop === decl.prop && !prev.value.includes("color-mix(");
      if (v && !hasFallback) decl.cloneBefore({ value: v }).__hrmsDone = true;
    }
    // A rule with only -webkit-backdrop-filter (the minifier sometimes drops the standard one) gets
    // the standard property too, for Chrome / Firefox.
    if (decl.prop === "-webkit-backdrop-filter") {
      const parent = decl.parent;
      let has = false;
      parent?.each((n) => {
        if (n.type === "decl" && n.prop === "backdrop-filter") has = true;
      });
      if (!has) decl.cloneAfter({ prop: "backdrop-filter" }).__hrmsDone = true;
    }
    decl.__hrmsDone = true;
  },
});
fallbacks.postcss = true;

const files = cssFiles(dir);
let changed = 0;
for (const file of files) {
  const css = readFileSync(file, "utf8");
  const parsed = postcss.parse(css, { from: file });
  const vars = staticVars(parsed);
  const result = await postcss([
    presetEnv({
      browsers,
      stage: 2,
      // Keep the modern declarations after the fallbacks.
      preserve: true,
      features: { "cascade-layers": true, "oklab-function": { preserve: true }, "lab-function": { preserve: true } },
      autoprefixer: { flexbox: "no-2009", grid: false },
    }),
    fallbacks(vars),
  ]).process(css, { from: file, to: file, map: false });
  if (result.css !== css) {
    writeFileSync(file, result.css);
    changed++;
  }
}
console.log(`legacy-css: updated ${changed} of ${files.length} CSS file(s) for ${browsers.join(", ")}`);
