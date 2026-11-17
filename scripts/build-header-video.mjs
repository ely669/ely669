#!/usr/bin/env node
// Builds assets/header.webp: the flowera.pro hero video behind the elydev
// wordmark, as an animated WebP. GitHub READMEs cannot play <video> as a
// banner, but they do animate WebP inside <img>.
//
// Pipeline: the text layers are drawn as SVG (same tokens as header.svg),
// rasterised with headless Chrome, then composited over the video by ffmpeg,
// with the four taglines crossfading and the panel corners cut by an alpha mask.
//
// Requires Google Chrome and ffmpeg (with libwebp) on the machine.
// Usage: node scripts/build-header-video.mjs

import { writeFile, mkdir, rm, stat, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BRAND, FONT_STACK, TAGLINES, esc } from "./brand.mjs";

const W = 1000;
const H = 290;
const SCALE = 2; // rendered at 2x so the type stays sharp on retina screens
const FPS = 20;
const SLOT = 5; // seconds each tagline stays on screen
const DURATION = TAGLINES.length * SLOT; // 20 s = two loops of the 10 s video
const VIDEO = "assets/source/hero-loop.mp4";
const INK = "#02000f"; // the video's own near-black, sampled from its left half

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

async function findChrome() {
  for (const c of CHROME_CANDIDATES) {
    try {
      await access(c);
      return c;
    } catch {}
  }
  throw new Error("Google Chrome not found; set CHROME_PATH");
}

async function michromaFace() {
  const res = await fetch("https://fonts.gstatic.com/s/michroma/v21/PN_zRfy9qWD8fEagAPg9pTk.woff2");
  if (!res.ok) throw new Error(`Michroma download failed: ${res.status}`);
  const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  return `@font-face{font-family:'Michroma';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
}

const svg = (inner, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${defs}</defs>
${inner}
</svg>`;

const plus = (x, y, s = 9) =>
  `<path d="M${x - s} ${y} H${x + s} M${x} ${y - s} V${y + s}" stroke="${BRAND.onDark}" stroke-opacity="0.35" stroke-width="1.2"/>`;

// Everything that stays put: a left-hand shade so the type reads over the
// light, the wordmark lockup, the column marks and the hairline border.
function baseLayer(fontFace) {
  return svg(
    `  <rect width="${W}" height="${H}" fill="url(#shade)"/>
  ${plus(70, 214)}
  ${plus(300, 214)}
  ${plus(530, 214)}
  <circle cx="70" cy="66" r="7" fill="#3ddc84" opacity="0.25"/>
  <circle cx="70" cy="66" r="4" fill="#3ddc84"/>
  <text x="84" y="70.5" font-family="${FONT_STACK}" font-size="11.5" letter-spacing="2.4" fill="${BRAND.onDark}" opacity="0.8">AVAILABLE FOR PROJECTS</text>
  <text x="64" y="138" font-family="Michroma,${FONT_STACK}" font-size="68" letter-spacing="2" fill="${BRAND.onDark}">ELYDEV</text>
  <text x="64" y="172" font-family="Michroma,${FONT_STACK}" font-size="15.5" letter-spacing="6.5" fill="${BRAND.onDark}" opacity="0.85">FULL-STACK DEVELOPER</text>
  <path d="M66 241 l7 -5 l-7 -5" fill="none" stroke="${BRAND.violetBright}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${BRAND.radius}" fill="none" stroke="${BRAND.onDark}" stroke-opacity="0.1"/>`,
    `<style>${fontFace}</style>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${INK}" stop-opacity="0.9"/>
      <stop offset="0.42" stop-color="${INK}" stop-opacity="0.55"/>
      <stop offset="0.7" stop-color="${INK}" stop-opacity="0"/>
    </linearGradient>`
  );
}

const taglineLayer = (text) =>
  svg(
    `  <text x="84" y="246" font-family="${FONT_STACK}" font-size="15" fill="${BRAND.onDark}" opacity="0.72">${esc(text)}</text>`
  );

// Grayscale mask for ffmpeg's alphamerge: white inside the rounded panel.
const maskLayer = () =>
  svg(`  <rect width="${W}" height="${H}" fill="#000"/>
  <rect width="${W}" height="${H}" rx="${BRAND.radius}" fill="#fff"/>`);

function rasterise(chrome, dir, name, svgText) {
  const svgPath = join(dir, `${name}.svg`);
  const htmlPath = join(dir, `${name}.html`);
  const pngPath = join(dir, `${name}.png`);
  return writeFile(svgPath, svgText)
    .then(() =>
      writeFile(
        htmlPath,
        `<!doctype html><html><body style="margin:0;background:transparent"><img src="${name}.svg" width="${W * SCALE}" height="${H * SCALE}" style="display:block"></body></html>`
      )
    )
    .then(() => {
      execFileSync(chrome, [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--default-background-color=00000000",
        `--window-size=${W * SCALE},${H * SCALE}`,
        "--virtual-time-budget=3000",
        `--screenshot=${pngPath}`,
        pathToFileURL(htmlPath).href,
      ], { stdio: "ignore" });
      return pngPath;
    });
}

// --- main --------------------------------------------------------------------

const chrome = await findChrome();
const work = join(tmpdir(), `elydev-header-${process.pid}`);
await mkdir(work, { recursive: true });

console.log("rasterising layers…");
const fontFace = await michromaFace();
const base = await rasterise(chrome, work, "base", baseLayer(fontFace));
const mask = await rasterise(chrome, work, "mask", maskLayer());
const tags = [];
for (const [i, t] of TAGLINES.entries()) tags.push(await rasterise(chrome, work, `tag${i}`, taglineLayer(t)));

console.log("compositing over the hero video…");
const ow = W * SCALE;
const oh = H * SCALE;
const shift = 100 * SCALE; // push the light right so the wordmark sits on the dark side
const inputs = ["-stream_loop", "-1", "-i", VIDEO];
for (const img of [base, mask, ...tags]) inputs.push("-loop", "1", "-framerate", String(FPS), "-i", img);

const fade = 0.5;
const chains = [
  `[0:v]crop=1920:557:0:400,scale=${ow}:${oh},pad=${ow + shift}:${oh}:${shift}:0:color=${INK.replace("#", "0x")},crop=${ow}:${oh}:0:0,fps=${FPS},format=rgba[v]`,
  `[v][1:v]overlay=format=auto[s0]`,
  ...tags.map((_, i) => {
    const st = i * SLOT;
    return `[${i + 3}:v]format=rgba,fade=t=in:st=${st}:d=${fade}:alpha=1,fade=t=out:st=${st + SLOT - fade}:d=${fade}:alpha=1[t${i}]`;
  }),
  ...tags.map((_, i) => `[s${i}][t${i}]overlay=format=auto[s${i + 1}]`),
  `[2:v]format=gray[m]`,
  `[s${tags.length}][m]alphamerge,format=yuva420p[out]`,
];

const out = resolve("assets/header.webp");
execFileSync("ffmpeg", [
  "-v", "error", "-y",
  ...inputs,
  "-filter_complex", chains.join(";"),
  "-map", "[out]",
  "-t", String(DURATION),
  "-c:v", "libwebp_anim",
  "-lossless", "0",
  "-q:v", process.env.WEBP_Q ?? "72",
  "-compression_level", "6",
  "-loop", "0",
  "-an",
  out,
], { stdio: "inherit" });

await rm(work, { recursive: true, force: true });
const s = await stat(out);
console.log(`  assets/header.webp — ${(s.size / 1024 / 1024).toFixed(2)} MB, ${DURATION}s @ ${FPS}fps, ${ow}x${oh}`);
