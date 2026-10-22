#!/usr/bin/env node
// Builds assets/header.svg and assets/stack.svg using the Flowera design system
// (https://www.flowera.pro): near-black surfaces, a violet mesh accent, Michroma
// for the wordmark and monochrome technology marks.
//
// Usage: node scripts/build-brand-assets.mjs

import { writeFile, mkdir, stat } from "node:fs/promises";
import { BRAND, FONT_STACK, esc } from "./brand.mjs";

// --- wordmark font -----------------------------------------------------------
// Embedded as a data URI so the mark renders identically everywhere; SVGs served
// through GitHub's image proxy cannot fetch external fonts.

const MICHROMA_URL = "https://fonts.gstatic.com/s/michroma/v21/PN_zRfy9qWD8fEagAPg9pTk.woff2";

async function michromaFace() {
  const res = await fetch(MICHROMA_URL);
  if (!res.ok) throw new Error(`Michroma download failed: ${res.status}`);
  const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  return `@font-face{font-family:'Michroma';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
}

// --- header ------------------------------------------------------------------

function headerSvg(fontFace) {
  const w = 1000;
  const h = 290;
  const r = BRAND.radius;

  // Mesh accent: soft violet lobes sweeping across the panel, echoing the site's
  // hero gradient without copying it pixel for pixel.
  const mesh = `
    <g filter="url(#soften)" opacity="0.95">
      <ellipse cx="760" cy="40"  rx="330" ry="200" fill="${BRAND.violet}" opacity="0.75"/>
      <ellipse cx="930" cy="190" rx="300" ry="190" fill="${BRAND.violetBright}" opacity="0.6"/>
      <ellipse cx="620" cy="250" rx="260" ry="140" fill="${BRAND.indigo}" opacity="0.8"/>
      <ellipse cx="880" cy="110" rx="150" ry="110" fill="${BRAND.lavender}" opacity="0.5"/>
    </g>`;

  // Thin plus marks, a recurring motif on the site.
  const plus = (x, y, s = 9) =>
    `<path d="M${x - s} ${y} H${x + s} M${x} ${y - s} V${x === 0 ? y + s : y + s}" stroke="${BRAND.onDark}" stroke-opacity="0.35" stroke-width="1.2"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="elydev — full-stack developer">
  <defs>
    <style>${fontFace}</style>
    <filter id="soften" x="-30%" y="-80%" width="160%" height="260%">
      <feGaussianBlur stdDeviation="62"/>
    </filter>
    <clipPath id="panel"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}"/></clipPath>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0.28" stop-color="${BRAND.panelDeep}" stop-opacity="1"/>
      <stop offset="0.62" stop-color="${BRAND.panelDeep}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${BRAND.panelDeep}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <g clip-path="url(#panel)">
    <rect width="${w}" height="${h}" fill="${BRAND.panelDeep}"/>
    ${mesh}
    <rect width="${w}" height="${h}" fill="url(#fade)"/>
    ${plus(70, 214)}
    ${plus(300, 214)}
    ${plus(530, 214)}

    <text x="64" y="132" font-family="Michroma,${FONT_STACK}" font-size="68" letter-spacing="2" fill="${BRAND.onDark}">ELYDEV</text>
    <text x="64" y="166" font-family="Michroma,${FONT_STACK}" font-size="15.5" letter-spacing="6.5" fill="${BRAND.onDark}" opacity="0.82">FULL-STACK DEVELOPER</text>

    <text x="64" y="246" font-family="${FONT_STACK}" font-size="15" fill="${BRAND.onDarkMuted}">Web platforms, backend systems and embedded firmware — shipped end to end.</text>
  </g>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${r}" fill="none" stroke="${BRAND.onDark}" stroke-opacity="0.09"/>
</svg>
`;
}

// --- technology grid ---------------------------------------------------------

const GROUPS = [
  {
    label: "LANGUAGES",
    icons: [
      ["typescript", "TypeScript"],
      ["javascript", "JavaScript"],
      ["python", "Python"],
      ["cplusplus", "C++"],
      ["c", "C"],
      ["dotnet", "C# / .NET"],
      ["gnubash", "Bash"],
    ],
  },
  {
    label: "FRONTEND",
    icons: [
      ["react", "React"],
      ["nextdotjs", "Next.js"],
      ["astro", "Astro"],
      ["tailwindcss", "Tailwind CSS"],
      ["vite", "Vite"],
      ["threedotjs", "Three.js"],
      ["figma", "Figma"],
    ],
  },
  {
    label: "BACKEND & DATA",
    icons: [
      ["nodedotjs", "Node.js"],
      ["express", "Express"],
      ["supabase", "Supabase"],
      ["postgresql", "PostgreSQL"],
      ["prisma", "Prisma"],
      ["redis", "Redis"],
      ["docker", "Docker"],
    ],
  },
  {
    label: "EMBEDDED & 3D",
    icons: [
      ["arduino", "Arduino"],
      ["espressif", "Espressif / ESP32"],
      ["raspberrypi", "Raspberry Pi"],
      ["godotengine", "Godot"],
      ["blender", "Blender"],
    ],
  },
  {
    label: "TOOLING",
    icons: [
      ["git", "Git"],
      ["githubactions", "GitHub Actions"],
      ["vercel", "Vercel"],
      ["linux", "Linux"],
      ["stripe", "Stripe"],
    ],
  },
];

async function iconPath(slug) {
  const url = `https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/${slug}.svg`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ! icon not found: ${slug} (${res.status})`);
    return null;
  }
  const svg = await res.text();
  const match = svg.match(/<path\s+d="([^"]+)"/);
  return match ? match[1] : null;
}

async function stackSvg() {
  const w = 1000;
  const iconSize = 32;
  const padX = 44;
  const columns = 7;
  const colW = (w - padX * 2) / columns;
  const rowHeight = 112;
  const h = 44 + GROUPS.length * rowHeight;

  const rows = [];
  for (let g = 0; g < GROUPS.length; g++) {
    const group = GROUPS[g];
    const top = 56 + g * rowHeight;
    if (g > 0) {
      rows.push(
        `  <line x1="${padX}" y1="${top - 34}" x2="${w - padX}" y2="${top - 34}" stroke="${BRAND.onDark}" stroke-opacity="0.07"/>`
      );
    }
    rows.push(
      `  <text x="${padX}" y="${top}" font-family="${FONT_STACK}" font-size="10.5" letter-spacing="2.4" fill="${BRAND.gray}">${esc(group.label)}</text>`
    );

    for (let i = 0; i < group.icons.length; i++) {
      const [slug, title] = group.icons[i];
      const d = await iconPath(slug);
      if (!d) continue;
      // Each cell centres its mark, with the product name directly underneath so
      // the grid reads without having to recognise every logo.
      const cx = padX + colW * i + colW / 2;
      const y = top + 20;
      const scale = iconSize / 24;
      rows.push(
        `  <g transform="translate(${(cx - iconSize / 2).toFixed(1)} ${y}) scale(${scale.toFixed(4)})" fill="${BRAND.onDark}" fill-opacity="0.93"><title>${esc(title)}</title><path d="${d}"/></g>`,
        `  <text x="${cx.toFixed(1)}" y="${y + iconSize + 17}" font-family="${FONT_STACK}" font-size="11" fill="${BRAND.onDark}" fill-opacity="0.72" text-anchor="middle">${esc(title)}</text>`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Technology stack">
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${BRAND.radius}" fill="${BRAND.panel}" stroke="${BRAND.onDark}" stroke-opacity="0.09"/>
${rows.join("\n")}
</svg>
`;
}

// --- main --------------------------------------------------------------------

await mkdir("assets", { recursive: true });

console.log("building header…");
const fontFace = await michromaFace();
await writeFile("assets/header.svg", headerSvg(fontFace));

console.log("building stack grid…");
await writeFile("assets/stack.svg", await stackSvg());

for (const f of ["assets/header.svg", "assets/stack.svg"]) {
  const s = await stat(f);
  console.log(`  ${f} — ${(s.size / 1024).toFixed(1)} KB`);
}
