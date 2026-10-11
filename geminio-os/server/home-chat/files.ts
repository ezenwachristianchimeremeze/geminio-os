/** Chat -> file conversion (pure). Only formats we can generate and validate for real: Markdown, plain text, CSV (from a Markdown table). */
import { createHash } from "node:crypto";
import { parseMarkdown, toSpeechText, type Inline } from "../../lib/home-chat/markdown";

import { buildDocx, buildPdf, buildXlsx, validateOffice } from "./office";
export type FileFormat = "md" | "txt" | "csv" | "pdf" | "docx" | "xlsx";
export class FileGenError extends Error { constructor(readonly code: "NO_TABLE" | "EMPTY" | "TOO_LARGE" | "INVALID_OUTPUT", message: string) { super(message); this.name = "FileGenError"; } }
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

const flat = (inl: Inline[]) => inl.map((x) => (x.t === "cite" ? "" : x.t === "link" ? x.v : "v" in x ? x.v : "")).join("").replace(/\s+/g, " ").trim();
/** RFC 4180 quoting, plus a leading-quote guard so spreadsheet apps don't execute "=cmd" style formulas. */
export function csvCell(v: string): string {
  const guarded = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}
export function tablesToCsv(markdown: string): string | null {
  const t = parseMarkdown(markdown).find((b): b is Extract<ReturnType<typeof parseMarkdown>[number], { t: "table" }> => b.t === "table");
  if (!t) return null;
  const rows = [t.header.map(flat), ...t.rows.map((r) => r.map(flat))];
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export type Generated = { filename: string; mimeType: string; bytes: Uint8Array; sha256: string; sizeBytes: number };
export function generateFile(input: { content: string; format: FileFormat; title: string }): Generated {
  if (!input.content.trim()) throw new FileGenError("EMPTY", "There is nothing to put in the file.");
  const base = input.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 50) || "geminio";
  let text: string; let mimeType: string;
  if (input.format === "pdf" || input.format === "docx" || input.format === "xlsx") {
    const title = input.title.trim() || "Geminio";
    const bytes = input.format === "pdf" ? buildPdf(input.content, title) : input.format === "docx" ? buildDocx(input.content, title) : buildXlsx(input.content);
    if (!bytes) throw new FileGenError("NO_TABLE", "This response has no table to turn into a spreadsheet.");
    const v = validateOffice(input.format, bytes);
    if (!v.ok) throw new FileGenError("INVALID_OUTPUT", `The generated ${input.format.toUpperCase()} failed validation (${v.reason}), so no file was created.`);
    if (bytes.length > MAX_FILE_BYTES) throw new FileGenError("TOO_LARGE", "The file would be larger than 2 MB.");
    const mime = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }[input.format];
    return { filename: `${base}.${input.format}`, mimeType: mime, bytes, sha256: createHash("sha256").update(bytes).digest("hex"), sizeBytes: bytes.length };
  }
  if (input.format === "csv") {
    const csv = tablesToCsv(input.content);
    if (!csv) throw new FileGenError("NO_TABLE", "This response has no table to turn into a spreadsheet.");
    text = "\ufeff" + csv; mimeType = "text/csv"; // BOM so Excel reads UTF-8
  } else if (input.format === "txt") { text = toSpeechText(input.content) || input.content; mimeType = "text/plain"; }
  else { text = input.content; mimeType = "text/markdown"; }
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > MAX_FILE_BYTES) throw new FileGenError("TOO_LARGE", "The file would be larger than 2 MB.");
  return { filename: `${base}.${input.format}`, mimeType, bytes, sha256: createHash("sha256").update(bytes).digest("hex"), sizeBytes: bytes.length };
}
/** Confirms what was stored is byte-identical before success is reported. */
export const verifyStored = (g: Generated, stored: Uint8Array) => stored.length === g.sizeBytes && createHash("sha256").update(stored).digest("hex") === g.sha256;
