#!/usr/bin/env node
// Builds assets/linkedin-banner.svg (1584x396, LinkedIn's cover size) in the
// Flowera design system. The left third stays clear: the profile photo and name
// overlap it on desktop.
//
// Usage: node scripts/build-linkedin-banner.mjs

import { writeFile, mkdir } from "node:fs/promises";
import { BRAND, FONT_STACK } from "./brand.mjs";

const MICHROMA_URL = "https://fonts.gstatic.com/s/michroma/v21/PN_zRfy9qWD8fEagAPg9pTk.woff2";

const res = await fetch(MICHROMA_URL);
if (!res.ok) throw new Error(`Michroma download failed: ${res.status}`);
const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
const fontFace = `@font-face{font-family:'Michroma';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;

const w = 1584;
const h = 396;

// Content sits right of x=520 so the avatar and name never cover it.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="elydev — full-stack developer">
  <defs>
    <style>${fontFace}</style>
    <filter id="soften" x="-30%" y="-100%" width="160%" height="300%">
      <feGaussianBlur stdDeviation="78"/>
    </filter>
    <linearGradient id="veil" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0.18" stop-color="${BRAND.panelDeep}" stop-opacity="1"/>
      <stop offset="0.52" stop-color="${BRAND.panelDeep}" stop-opacity="0.62"/>
      <stop offset="1" stop-color="${BRAND.panelDeep}" stop-opacity="0.05"/>
    </linearGradient>
  </defs>

  <rect width="${w}" height="${h}" fill="${BRAND.panelDeep}"/>
  <g filter="url(#soften)">
    <ellipse cx="1240" cy="40"  rx="420" ry="230" fill="${BRAND.violet}" opacity="0.8"/>
    <ellipse cx="1480" cy="300" rx="380" ry="240" fill="${BRAND.violetBright}" opacity="0.62"/>
    <ellipse cx="980"  cy="360" rx="330" ry="180" fill="${BRAND.indigo}" opacity="0.85"/>
    <ellipse cx="1380" cy="150" rx="190" ry="130" fill="${BRAND.lavender}" opacity="0.5"/>
  </g>
  <rect width="${w}" height="${h}" fill="url(#veil)"/>

  <text x="524" y="168" font-family="Michroma,${FONT_STACK}" font-size="60" letter-spacing="2" fill="${BRAND.onDark}">ELYDEV</text>
  <text x="527" y="206" font-family="Michroma,${FONT_STACK}" font-size="13.5" letter-spacing="5.6" fill="${BRAND.onDark}" opacity="0.82">FULL-STACK DEVELOPER</text>

  <line x1="527" y1="238" x2="1060" y2="238" stroke="${BRAND.onDark}" stroke-opacity="0.22"/>

  <text x="527" y="274" font-family="${FONT_STACK}" font-size="19" fill="${BRAND.onDark}" fill-opacity="0.95">Plataformas web · Backend e integrações · Firmware ESP32</text>
  <text x="527" y="306" font-family="${FONT_STACK}" font-size="16" fill="${BRAND.onDarkMuted}">TypeScript · React · Next.js · Astro · Node.js · Python · C/C++</text>
  <text x="527" y="344" font-family="${FONT_STACK}" font-size="15" fill="${BRAND.onDark}" fill-opacity="0.78">flowera.pro · github.com/ely669</text>
</svg>
`;

await mkdir("assets", { recursive: true });
await writeFile("assets/linkedin-banner.svg", svg);
console.log("assets/linkedin-banner.svg written");
