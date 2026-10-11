import { describe, expect, it } from "vitest";
import { blend, contrastRatio } from "../lib/contrast";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { themeColors } = require("../theme.config.js") as { themeColors: Record<string, { light: string; dark: string }> };

const MODES = ["light", "dark"] as const;
const SEMANTIC = ["primary", "accent", "success", "warning", "error", "info"] as const;
const AA_TEXT = 4.5;
const AA_UI = 3;
const tok = (name: string, mode: "light" | "dark") => themeColors[name][mode];
const surfaces = (mode: "light" | "dark") => ["background", "surface", "surfaceMuted"].map((n) => ({ n, hex: tok(n, mode) }));

describe("blueprint brand colours are preserved for fills", () => {
  it("keeps the exact light-mode blueprint hex values", () => {
    expect(tok("primary", "light")).toBe("#4F46E5");
    expect(tok("accent", "light")).toBe("#3B82F6");
    expect(tok("success", "light")).toBe("#10B981");
    expect(tok("warning", "light")).toBe("#F59E0B");
    expect(tok("error", "light")).toBe("#EF4444");
    expect(tok("background", "light")).toBe("#F8FAFC");
    expect(tok("surface", "light")).toBe("#FFFFFF");
    expect(tok("foreground", "light")).toBe("#0F172A");
    expect(tok("border", "light")).toBe("#E2E8F0");
  });
});

describe("neutral text meets WCAG AA (4.5:1) in both modes", () => {
  for (const mode of MODES) {
    for (const textToken of ["foreground", "muted"]) {
      for (const s of surfaces(mode)) {
        it(`${mode}: ${textToken} on ${s.n}`, () => {
          expect(contrastRatio(tok(textToken, mode), s.hex)).toBeGreaterThan(AA_TEXT - 0.001);
        });
      }
    }
  }
});

describe("semantic text tokens meet AA on surfaces AND on their own 20% tint", () => {
  for (const mode of MODES) {
    for (const name of SEMANTIC) {
      const text = tok(`${name}Text`, mode);
      for (const s of surfaces(mode)) {
        it(`${mode}: ${name}Text on ${s.n}`, () => {
          expect(contrastRatio(text, s.hex)).toBeGreaterThan(AA_TEXT - 0.001);
        });
        it(`${mode}: ${name}Text on bg-${name}/20 over ${s.n}`, () => {
          expect(contrastRatio(text, blend(tok(name, mode), s.hex, 0.2))).toBeGreaterThan(AA_TEXT - 0.001);
        });
        it(`${mode}: ${name}Text on bg-${name}/10 over ${s.n}`, () => {
          expect(contrastRatio(text, blend(tok(name, mode), s.hex, 0.1))).toBeGreaterThan(AA_TEXT - 0.001);
        });
      }
    }
  }
});

describe("text on solid brand fills (buttons, badges, status pills) meets AA", () => {
  for (const mode of MODES) {
    for (const name of SEMANTIC) {
      it(`${mode}: ${name}Foreground on ${name}`, () => {
        expect(contrastRatio(tok(`${name}Foreground`, mode), tok(name, mode))).toBeGreaterThan(AA_TEXT - 0.001);
      });
    }
  }
});

describe("the previously failing blueprint colours are no longer used as text", () => {
  it("documents the original failures (regression guard for the bug itself)", () => {
    expect(contrastRatio("#10B981", "#FFFFFF")).toBeLessThan(AA_TEXT); // 2.54
    expect(contrastRatio("#F59E0B", "#FFFFFF")).toBeLessThan(AA_TEXT); // 2.15
    expect(contrastRatio("#EF4444", "#FFFFFF")).toBeLessThan(AA_TEXT); // 3.76
    expect(contrastRatio("#3B82F6", "#FFFFFF")).toBeLessThan(AA_TEXT); // 3.68
  });
  it("white text on the blueprint success/warning/error/accent fills would fail", () => {
    for (const hex of ["#10B981", "#F59E0B", "#EF4444", "#3B82F6"]) expect(contrastRatio("#FFFFFF", hex)).toBeLessThan(AA_TEXT);
  });
  it("text tokens keep the hue family of the brand colour (identity preserved)", () => {
    const hue = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      if (d === 0) return 0;
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    for (const name of ["primary", "accent", "error", "warning"] as const) {
      const delta = Math.abs(hue(tok(name, "light")) - hue(tok(`${name}Text`, "light")));
      expect(Math.min(delta, 360 - delta)).toBeLessThan(15);
    }
  });
});

describe("focus indicator (WCAG 1.4.11) is >= 3:1 on every surface", () => {
  for (const mode of MODES) {
    for (const s of surfaces(mode)) {
      it(`${mode}: focus ring on ${s.n}`, () => {
        expect(contrastRatio(tok("focus", mode), s.hex)).toBeGreaterThan(AA_UI - 0.001);
      });
    }
  }
});

describe("token set is complete and consistent", () => {
  it("every semantic colour has Text and Foreground companions in both modes", () => {
    for (const name of SEMANTIC) {
      for (const suffix of ["Text", ...(name === "primary" ? ["Foreground"] : ["Foreground"])]) {
        const t = themeColors[`${name}${suffix}`];
        expect(t).toBeDefined();
        expect(t.light).toMatch(/^#[0-9A-F]{6}$/);
        expect(t.dark).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { accentAsText, onFill, shade } from "../lib/contrast";

function accentsIn(file: string): string[] {
  const src = readFileSync(join(process.cwd(), file), "utf8");
  return [...new Set([...src.matchAll(/accent:\s*"(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1].toUpperCase()))];
}

describe("per-product accent fills (real catalog values)", () => {
  const accents = [...accentsIn("lib/product-catalog.ts"), ...accentsIn("app/module/[module].tsx"), ...accentsIn("app/(tabs)/workspace.tsx")];
  it("finds the real accents (guards against the regex silently matching nothing)", () => {
    expect(accents.length).toBeGreaterThan(20);
  });
  for (const accent of accents) {
    it(`${accent}: onFill() always yields text with >= 4.5:1`, () => {
      const pair = onFill(accent);
      expect(contrastRatio(pair.text, pair.fill)).toBeGreaterThan(AA_TEXT - 0.001);
    });
    it(`${accent}: accentAsText() on white/surface and dark surface is >= 4.5:1`, () => {
      expect(contrastRatio(accentAsText(accent, "#FFFFFF"), "#FFFFFF")).toBeGreaterThan(AA_TEXT - 0.001);
      expect(contrastRatio(accentAsText(accent, "#111827"), "#111827")).toBeGreaterThan(AA_TEXT - 0.001);
    });
  }
  it("onFill keeps a compliant accent unchanged and only darkens when it must", () => {
    expect(onFill("#635BFF")).toEqual({ fill: "#635BFF", text: "#FFFFFF" });
    expect(onFill("#E58A2B").text).toBe("#0F172A");
    const adjusted = onFill("#2B8A78");
    expect(contrastRatio(adjusted.text, adjusted.fill)).toBeGreaterThan(AA_TEXT - 0.001);
  });
  it("shade moves toward black/white", () => {
    expect(shade("#808080", -1)).toBe("#000000");
    expect(shade("#808080", 1)).toBe("#FFFFFF");
  });
});

describe("source scan: the failing patterns can not come back", () => {
  const files = (dir: string): string[] => {
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    return readdirSync(dir).flatMap((n: string) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
    });
  };
  const sources = [...files(join(process.cwd(), "app")), ...files(join(process.cwd(), "components"))].map((p) => ({ p, s: readFileSync(p, "utf8") }));
  it("no bare text-success/warning/error/accent/info class (they fail 4.5:1 as text)", () => {
    const hits = sources.flatMap(({ p, s }) => [...s.matchAll(/(?<![A-Za-z-])text-(success|warning|error|accent|info)(?![A-Za-z])/g)].map((m) => `${p}: ${m[0]}`));
    expect(hits).toEqual([]);
  });
  it("no text-white (use <fill>Foreground so dark mode flips correctly)", () => {
    const hits = sources.flatMap(({ p, s }) => [...s.matchAll(/(?<![A-Za-z-])text-white\b/g)].map((m) => `${p}: ${m[0]}`));
    expect(hits).toEqual([]);
  });
  it("no off-token Tailwind palette fills/text for status colours", () => {
    const hits = sources.flatMap(({ p, s }) => [...s.matchAll(/\b(?:bg|text|border)-(?:green|red|yellow)-\d{3}\b/g)].map((m) => `${p}: ${m[0]}`));
    expect(hits).toEqual([]);
  });
});
