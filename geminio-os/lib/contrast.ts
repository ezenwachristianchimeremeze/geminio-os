/** WCAG 2.x contrast helpers (pure). Used by tests/design-tokens.test.ts. */
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
export function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Invalid hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** Colour of `fg` drawn at `alpha` over opaque `bg` (e.g. Tailwind bg-success/20). */
export function blend(fg: string, bg: string, alpha: number): string {
  const f = parseHex(fg);
  const b = parseHex(bg);
  const mix = f.map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i]));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

const DARK_TEXT = "#0F172A";
const LIGHT_TEXT = "#FFFFFF";

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}
/** Move a colour toward black (amount < 0) or white (amount > 0), preserving hue. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  return toHex(r + (target - r) * t, g + (target - g) * t, b + (target - b) * t);
}

/**
 * Text colour + fill for content drawn ON an arbitrary accent fill.
 * Prefers white, then the dark text colour; if neither reaches `min`, the fill
 * is darkened (hue preserved) until white text does. Never returns a pair
 * below `min`.
 */
export function onFill(fill: string, min = 4.5): { fill: string; text: string } {
  if (contrastRatio(LIGHT_TEXT, fill) >= min) return { fill, text: LIGHT_TEXT };
  if (contrastRatio(DARK_TEXT, fill) >= min) return { fill, text: DARK_TEXT };
  let f = fill;
  for (let i = 0; i < 100 && contrastRatio(LIGHT_TEXT, f) < min; i += 1) f = shade(f, -0.02);
  return { fill: f, text: LIGHT_TEXT };
}

/** An accent colour used as TEXT on `background`: darkens/lightens until it meets `min`. */
export function accentAsText(accent: string, background: string, min = 4.5): string {
  if (contrastRatio(accent, background) >= min) return accent;
  const darker = luminance(background) > 0.5;
  let c = accent;
  for (let i = 0; i < 100 && contrastRatio(c, background) < min; i += 1) c = shade(c, darker ? -0.04 : 0.04);
  return c;
}
