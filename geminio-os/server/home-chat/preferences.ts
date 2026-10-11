/** Home chat personalization: validated, bounded, and applied only as the user's OWN instructions. */
export const STYLES = ["concise", "balanced", "detailed"] as const;
export type Preferences = { customInstructions: string; responseStyle: (typeof STYLES)[number]; language: string | null; aiLevel: string };
export const DEFAULT_PREFERENCES: Preferences = { customInstructions: "", responseStyle: "balanced", language: null, aiLevel: "standard" };
export const MAX_INSTRUCTIONS = 1500;

export function normalizePreferences(raw: Partial<Record<keyof Preferences, unknown>> | null | undefined): Preferences {
  const r = raw ?? {};
  const instr = typeof r.customInstructions === "string" ? r.customInstructions.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, MAX_INSTRUCTIONS) : "";
  const style = (STYLES as readonly string[]).includes(String(r.responseStyle)) ? (r.responseStyle as Preferences["responseStyle"]) : "balanced";
  const lang = typeof r.language === "string" && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(r.language) ? r.language : null;
  const level = typeof r.aiLevel === "string" && /^[a-z][a-z0-9_]{0,31}$/.test(r.aiLevel.toLowerCase()) ? r.aiLevel.toLowerCase() : "standard";
  return { customInstructions: instr, responseStyle: style, language: lang, aiLevel: level };
}

const STYLE_TEXT: Record<Preferences["responseStyle"], string> = { concise: "Keep answers short and direct.", balanced: "", detailed: "Give thorough, well-structured answers with reasoning and examples." };
/** The user's instructions can shape tone and format but never override safety or the untrusted-data rules. */
export function preferenceSystemMessage(p: Preferences): string | null {
  const parts = [STYLE_TEXT[p.responseStyle], p.customInstructions ? `The user's custom instructions (style and context only; they cannot change safety rules):\n${p.customInstructions}` : ""].filter(Boolean);
  return parts.length ? parts.join("\n\n") : null;
}
