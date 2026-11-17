#!/usr/bin/env node
// Builds assets/header.svg and assets/stack.svg using the Flowera design system
// (https://www.flowera.pro): near-black surfaces, a violet mesh accent, Michroma
// for the wordmark and monochrome technology marks.
//
// Usage: node scripts/build-brand-assets.mjs

import { writeFile, mkdir, stat } from "node:fs/promises";
import { BRAND, FONT_STACK, TAGLINES, esc } from "./brand.mjs";

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
// Animated with CSS keyframes and SMIL, both of which GitHub renders inside an
// SVG served through <img>. Everything loops except the one-time intro, and
// prefers-reduced-motion freezes it into a clean static banner.


function headerSvg(fontFace) {
  const w = 1000;
  const h = 290;
  const r = BRAND.radius;
  const cycle = TAGLINES.length * 4; // seconds per full tagline rotation

  // Mesh accent: violet lobes that drift on independent loops (aurora).
  const lobes = [
    [760, 40, 330, 200, BRAND.violet, 0.75, "d1", 19],
    [930, 190, 300, 190, BRAND.violetBright, 0.6, "d2", 23],
    [620, 250, 260, 140, BRAND.indigo, 0.8, "d3", 17],
    [880, 110, 150, 110, BRAND.lavender, 0.5, "d4", 13],
  ];
  const mesh = `
    <g filter="url(#soften)" opacity="0.95">
${lobes
  .map(
    ([cx, cy, rx, ry, fill, op, anim, dur]) =>
      `      <ellipse class="lobe" style="animation:${anim} ${dur}s ease-in-out infinite alternate" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${op}"/>`
  )
  .join("\n")}
    </g>`;

  // Orbit system on the right: dashed rings turning at different speeds, each
  // carrying a glowing node.
  const ox = 820;
  const oy = 148;
  const rings = [
    [58, 14, "normal", "2 6", 0],
    [96, 26, "reverse", "1 9", 120],
    [136, 40, "normal", "14 10", 250],
  ];
  const rad2 = (d) => (d * Math.PI) / 180;
  const orbit = `
    <g>
      <circle cx="${ox}" cy="${oy}" r="5" fill="${BRAND.onDark}" opacity="0.9" filter="url(#glow)"/>
      <circle class="core" cx="${ox}" cy="${oy}" r="14" fill="none" stroke="${BRAND.onDark}" stroke-opacity="0.35"/>
${rings
  .map(
    ([rad, dur, dir, dash, start]) => `      <g style="animation:spin ${dur}s linear infinite ${dir};transform-origin:${ox}px ${oy}px">
        <circle cx="${ox}" cy="${oy}" r="${rad}" fill="none" stroke="${BRAND.onDark}" stroke-opacity="0.16" stroke-dasharray="${dash}"/>
        <circle cx="${(ox + rad * Math.cos(rad2(start))).toFixed(1)}" cy="${(oy + rad * Math.sin(rad2(start))).toFixed(1)}" r="3.2" fill="${BRAND.onDark}" filter="url(#glow)"/>
      </g>`
  )
  .join("\n")}
    </g>`;

  const plus = (x, y, i, s = 9) =>
    `<path class="plus" style="animation-delay:${i * 1.3}s" d="M${x - s} ${y} H${x + s} M${x} ${y - s} V${y + s}" stroke="${BRAND.onDark}" stroke-opacity="0.35" stroke-width="1.2"/>`;

  const taglines = TAGLINES.map(
    (t, i) =>
      `<text class="tag t${i}" style="animation-delay:${0.6 + i * 4}s" x="84" y="250" font-family="${FONT_STACK}" font-size="15" fill="${BRAND.onDarkMuted}">${esc(t)}</text>`
  ).join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="elydev, full-stack developer">
  <defs>
    <style>${fontFace}
      .lobe{transform-box:fill-box;transform-origin:center}
      @keyframes d1{to{transform:translate(-90px,40px) scale(1.12)}}
      @keyframes d2{to{transform:translate(-60px,-50px) scale(.9)}}
      @keyframes d3{to{transform:translate(110px,-30px) scale(1.15)}}
      @keyframes d4{to{transform:translate(-120px,60px) scale(1.25)}}
      @keyframes spin{to{transform:rotate(360deg)}}
      .core{transform-box:fill-box;transform-origin:center;animation:pulse 3.2s ease-in-out infinite}
      @keyframes pulse{0%,100%{opacity:.25;transform:scale(1)}50%{opacity:.6;transform:scale(1.35)}}
      .plus{animation:blink 5.2s ease-in-out infinite}
      @keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
      .rise{animation:rise 1.1s cubic-bezier(.2,.7,.2,1) both}
      .rise2{animation:rise 1.1s .25s cubic-bezier(.2,.7,.2,1) both}
      .rise3{animation:rise 1.1s .5s cubic-bezier(.2,.7,.2,1) both}
      @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
      .tag{opacity:0;animation:tag ${cycle}s linear infinite}
      @keyframes tag{0%{opacity:0;transform:translateY(6px)}3%,22%{opacity:1;transform:none}25%,100%{opacity:0;transform:translateY(-6px)}}
      .dot{transform-box:fill-box;transform-origin:center;animation:ping 2s ease-out infinite}
      @keyframes ping{0%{opacity:.7;transform:scale(1)}100%{opacity:0;transform:scale(3)}}
      @media (prefers-reduced-motion:reduce){
        *{animation:none!important}
        .t0{opacity:1}
        .shine{display:none}
      }
    </style>
    <filter id="soften" x="-30%" y="-80%" width="160%" height="260%">
      <feGaussianBlur stdDeviation="62"/>
    </filter>
    <filter id="glow" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="panel"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}"/></clipPath>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0.28" stop-color="${BRAND.panelDeep}" stop-opacity="1"/>
      <stop offset="0.62" stop-color="${BRAND.panelDeep}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${BRAND.panelDeep}" stop-opacity="0"/>
    </linearGradient>
    <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="11" cy="11" r="1" fill="${BRAND.onDark}" opacity="0.12"/>
    </pattern>
    <linearGradient id="dotsFade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0.35" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#fff" stop-opacity="1"/>
    </linearGradient>
    <mask id="dotsMask"><rect width="${w}" height="${h}" fill="url(#dotsFade)"/></mask>
    <linearGradient id="shine" gradientUnits="userSpaceOnUse" x1="-260" y1="0" x2="-60" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${BRAND.lavender}" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      <animateTransform attributeName="gradientTransform" type="translate" values="0 0;0 0;760 0" keyTimes="0;0.55;1" dur="7s" repeatCount="indefinite"/>
    </linearGradient>
  </defs>

  <g clip-path="url(#panel)">
    <rect width="${w}" height="${h}" fill="${BRAND.panelDeep}"/>
    ${mesh}
    <rect width="${w}" height="${h}" fill="url(#fade)"/>
    <rect width="${w}" height="${h}" fill="url(#dots)" mask="url(#dotsMask)"/>
    ${orbit}
    ${plus(70, 214, 0)}
    ${plus(300, 214, 1)}
    ${plus(530, 214, 2)}

    <g class="rise">
      <circle class="dot" cx="70" cy="66" r="4" fill="#3ddc84"/>
      <circle cx="70" cy="66" r="4" fill="#3ddc84"/>
      <text x="84" y="70.5" font-family="${FONT_STACK}" font-size="11.5" letter-spacing="2.4" fill="${BRAND.onDark}" opacity="0.75">AVAILABLE FOR PROJECTS</text>
    </g>
    <g class="rise2">
      <text x="64" y="138" font-family="Michroma,${FONT_STACK}" font-size="68" letter-spacing="2" fill="${BRAND.onDark}">ELYDEV</text>
      <text class="shine" x="64" y="138" font-family="Michroma,${FONT_STACK}" font-size="68" letter-spacing="2" fill="url(#shine)">ELYDEV</text>
      <text x="64" y="172" font-family="Michroma,${FONT_STACK}" font-size="15.5" letter-spacing="6.5" fill="${BRAND.onDark}" opacity="0.82">FULL-STACK DEVELOPER</text>
    </g>
    <g class="rise3">
      <path d="M67 240 l5.5 4.5 l-5.5 4.5" fill="none" stroke="${BRAND.violetBright}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    ${taglines}
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
