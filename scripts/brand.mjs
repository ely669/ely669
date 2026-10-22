// Flowera design tokens (https://www.flowera.pro) — near-black surfaces, violet
// accent, generous radii. Shared by the asset generators in this folder.

export const BRAND = {
  panelDeep: "#0a0a0a",
  panel: "#0d0d0d",
  body: "#121212",
  onDark: "#ffffff",
  onDarkMuted: "#ffffff99",
  gray: "#7b7b7b",
  hairline: "#ffffff17",
  violet: "#7b1dff",
  violetBright: "#a447ff",
  lavender: "#c0a0f0",
  indigo: "#4c1d95",
  radius: 24,
};

export const FONT_STACK =
  "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const fmt = (n) => n.toLocaleString("en-US");

// Panel shell every card shares: rounded near-black surface + hairline border.
export function panel(width, height, inner, { label = "" } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${BRAND.radius}" fill="${BRAND.panel}" stroke="${BRAND.onDark}" stroke-opacity="0.09"/>
${inner}
</svg>
`;
}

export function sectionLabel(x, y, text) {
  return `  <text x="${x}" y="${y}" font-family="${FONT_STACK}" font-size="10.5" letter-spacing="2.4" fill="${BRAND.gray}">${esc(text)}</text>`;
}
