/**
 * Dependency-free writers for DOCX, XLSX and PDF (no network/npm needed), plus structural validators used at runtime
 * before any file is reported as created. Content comes from the safe markdown tree (lib/home-chat/markdown.ts).
 * PDF limitation: Latin-1 text only (other characters are replaced with "?"); fonts are the 14 standard PDF fonts.
 */
import { parseMarkdown, type Block, type Inline } from "../../lib/home-chat/markdown";

const enc = new TextEncoder();
const flat = (inl: Inline[]) => inl.map((x) => (x.t === "cite" ? "" : x.t === "link" ? x.v : "v" in x ? x.v : "")).join("").replace(/\s+/g, " ").trim();
const xml = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------- ZIP (stored, CRC32) ----------------
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
  const DOS_TIME = 0, DOS_DATE = (2026 - 1980) << 9 | 1 << 5 | 1; // fixed timestamp => reproducible output
  for (const f of files) {
    const name = enc.encode(f.name); const crc = crc32(f.data);
    const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, DOS_TIME, true); lh.setUint16(12, DOS_DATE, true); lh.setUint32(14, crc, true); lh.setUint32(18, f.data.length, true); lh.setUint32(22, f.data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    const cd = new DataView(new ArrayBuffer(46)); cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true); cd.setUint16(12, DOS_TIME, true); cd.setUint16(14, DOS_DATE, true); cd.setUint32(16, crc, true); cd.setUint32(20, f.data.length, true); cd.setUint32(24, f.data.length, true); cd.setUint16(28, name.length, true); cd.setUint32(42, offset, true);
    parts.push(new Uint8Array(lh.buffer), name, f.data); central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)]; const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let p = 0; for (const a of all) { out.set(a, p); p += a.length; } return out;
}
export function zipList(bytes: Uint8Array): { name: string; crcOk: boolean; size: number }[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let e = bytes.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("not a zip file");
  const count = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out: { name: string; crcOk: boolean; size: number }[] = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("corrupt central directory");
    const crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nl));
    const lnl = dv.getUint16(lo + 26, true), lxl = dv.getUint16(lo + 28, true); const data = bytes.subarray(lo + 30 + lnl + lxl, lo + 30 + lnl + lxl + size);
    out.push({ name, size, crcOk: data.length === size && crc32(data) === crc }); p += 46 + nl + xl + cl;
  }
  return out;
}

// ---------------- DOCX ----------------
const run = (t: string, o: { b?: boolean; i?: boolean; mono?: boolean; size?: number } = {}) => `<w:r><w:rPr>${o.mono ? '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>' : ""}${o.b ? "<w:b/>" : ""}${o.i ? "<w:i/>" : ""}${o.size ? `<w:sz w:val="${o.size}"/>` : ""}</w:rPr><w:t xml:space="preserve">${xml(t)}</w:t></w:r>`;
const inlineRuns = (inl: Inline[]) => inl.map((x) => x.t === "cite" ? "" : x.t === "bold" ? run(x.v, { b: true }) : x.t === "italic" ? run(x.v, { i: true }) : x.t === "code" ? run(x.v, { mono: true }) : x.t === "link" ? run(`${x.v} (${x.href})`) : run("v" in x ? x.v : "")).join("");
const para = (inner: string, style?: string) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}${inner}</w:p>`;
function docxBody(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.t === "h") out.push(para(inlineRuns(b.inline), `Heading${b.level}`));
    else if (b.t === "p") out.push(para(inlineRuns(b.inline)));
    else if (b.t === "quote") out.push(para(`<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${xml(flat(b.inline))}</w:t></w:r>`));
    else if (b.t === "ul" || b.t === "ol") b.items.forEach((it, i) => out.push(para(run(b.t === "ol" ? `${i + 1}. ` : "• ") + inlineRuns(it))));
    else if (b.t === "code") for (const line of b.code.split("\n")) out.push(para(run(line, { mono: true, size: 20 })));
    else if (b.t === "hr") out.push(para(run("────────────────────")));
    else if (b.t === "table") {
      const row = (cells: Inline[][], head: boolean) => `<w:tr>${cells.map((c) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${para(head ? run(flat(c), { b: true }) : inlineRuns(c))}</w:tc>`).join("")}</w:tr>`;
      out.push(`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join("")}</w:tblBorders></w:tblPr><w:tblGrid>${b.header.map(() => `<w:gridCol w:w="${Math.floor(9600 / Math.max(1, b.header.length))}"/>`).join("")}</w:tblGrid>${row(b.header, true)}${b.rows.map((r) => row(r, false)).join("")}</w:tbl>`, para(""));
    }
  }
  return out.join("");
}
export function buildDocx(markdown: string, title: string): Uint8Array {
  const blocks = parseMarkdown(markdown);
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${[1, 2, 3].map((n) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${[36, 30, 26][n - 1]}"/></w:rPr></w:style>`).join("")}<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style></w:styles>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${para(run(title, { b: true, size: 40 }))}${docxBody(blocks)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const f = (name: string, s: string) => ({ name, data: enc.encode(s) });
  return zipStore([
    f("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`),
    f("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    f("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    f("word/styles.xml", styles), f("word/document.xml", doc),
  ]);
}

// ---------------- XLSX ----------------
const colName = (i: number) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const sheetName = (s: string, i: number) => (s.replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 31) || `Sheet${i + 1}`);
const NUM = /^-?\d{1,15}(\.\d+)?$/;
function sheetXml(rows: string[][]): string {
  const widths: number[] = []; rows.forEach((r) => r.forEach((c, i) => { widths[i] = Math.min(60, Math.max(widths[i] ?? 8, c.length + 2)); }));
  const cols = `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`;
  const body = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((c, ci) => { const ref = `${colName(ci)}${ri + 1}`; return ri > 0 && NUM.test(c) ? `<c r="${ref}"><v>${c}</v></c>` : `<c r="${ref}" t="inlineStr"${ri === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${xml(c)}</t></is></c>`; }).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${body}</sheetData></worksheet>`;
}
/** Every markdown table becomes a sheet. Strings are always inline text, never formulas, so "=cmd" cannot execute. Returns null when there is no table. */
export function buildXlsx(markdown: string): Uint8Array | null {
  const tables = parseMarkdown(markdown).filter((b): b is Extract<Block, { t: "table" }> => b.t === "table").slice(0, 10);
  if (!tables.length) return null;
  const sheets = tables.map((t) => [t.header.map(flat), ...t.rows.map((r) => r.map(flat))]);
  const names = sheets.map((_, i) => sheetName(`Table ${i + 1}`, i));
  const f = (name: string, s: string) => ({ name, data: enc.encode(s) });
  return zipStore([
    f("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`),
    f("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    f("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`),
    f("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    f("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`),
    ...sheets.map((rows, i) => f(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(rows))),
  ]);
}

// ---------------- PDF (standard fonts, Latin-1) ----------------
const W_HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const W_HELVB = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
type Font = "F1" | "F2" | "F3";
const glyphW = (ch: number, f: Font) => (f === "F3" ? 600 : (f === "F2" ? W_HELVB : W_HELV)[ch - 32] ?? 556);
const latin1 = (s: string) => Array.from(s.replace(/\t/g, "    ").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u2022/g, "*").replace(/\u2026/g, "...")).map((c) => { const n = c.codePointAt(0)!; return n >= 32 && n < 127 ? n : n >= 160 && n <= 255 ? n : 63; });
const width = (codes: number[], f: Font, size: number) => codes.reduce((a, c) => a + (c < 127 ? glyphW(c, f) : 556), 0) * size / 1000;
function wrap(text: string, f: Font, size: number, maxW: number): number[][] {
  const lines: number[][] = []; let cur: number[] = [];
  for (const word of latin1(text).reduce<number[][]>((acc, c) => { if (c === 32) acc.push([]); else (acc[acc.length - 1] ??= acc[acc.length] = []).push(c); return acc; }, [[]])) {
    const w = word.length ? word : [];
    const trial = cur.length ? [...cur, 32, ...w] : w;
    if (width(trial, f, size) <= maxW) { cur = trial; continue; }
    if (cur.length) lines.push(cur);
    let rest = w; while (width(rest, f, size) > maxW) { let k = rest.length; while (k > 1 && width(rest.slice(0, k), f, size) > maxW) k--; lines.push(rest.slice(0, k)); rest = rest.slice(k); }
    cur = rest;
  }
  if (cur.length || !lines.length) lines.push(cur);
  return lines;
}
export function buildPdf(markdown: string, title: string): Uint8Array {
  const PAGE_W = 595, PAGE_H = 842, M = 54, maxW = PAGE_W - 2 * M;
  const pages: string[][] = [[]]; let y = PAGE_H - M;
  const put = (codes: number[], f: Font, size: number, x: number) => { const esc = codes.map((c) => (c === 40 || c === 41 || c === 92 ? `\\${String.fromCharCode(c)}` : c >= 128 ? `\\${c.toString(8).padStart(3, "0")}` : String.fromCharCode(c))).join(""); pages[pages.length - 1].push(`BT /${f} ${size} Tf ${x} ${y.toFixed(2)} Td (${esc}) Tj ET`); };
  const line = (text: string, f: Font, size: number, indent = 0, gapAfter = 0) => { for (const l of wrap(text, f, size, maxW - indent)) { const lh = size * 1.3; if (y - lh < M) { pages.push([]); y = PAGE_H - M; } y -= lh; put(l, f, size, M + indent); } y -= gapAfter; };
  line(title, "F2", 20, 0, 10);
  for (const b of parseMarkdown(markdown)) {
    if (b.t === "h") line(flat(b.inline), "F2", [18, 15, 13][b.level - 1], 0, 4);
    else if (b.t === "p" || b.t === "quote") line(flat(b.inline), "F1", 11, b.t === "quote" ? 14 : 0, 6);
    else if (b.t === "ul" || b.t === "ol") { b.items.forEach((it, i) => line(`${b.t === "ol" ? `${i + 1}.` : "-"} ${flat(it)}`, "F1", 11, 10, 2)); y -= 4; }
    else if (b.t === "code") { for (const l of b.code.split("\n")) line(l, "F3", 9, 8, 0); y -= 6; }
    else if (b.t === "table") { for (const r of [b.header, ...b.rows]) line(r.map(flat).join("  |  "), r === b.header ? "F2" : "F1", 10, 0, 1); y -= 6; }
    else if (b.t === "hr") y -= 8;
  }
  // objects: 1 catalog, 2 pages, 3-5 fonts, then per page: page obj + content obj
  const objs: Uint8Array[] = []; const nPages = pages.length; const pageObj = (i: number) => 6 + i * 2; const contObj = (i: number) => 7 + i * 2;
  const text = (s: string) => enc.encode(s);
  objs[1] = text(`<< /Type /Catalog /Pages 2 0 R >>`);
  objs[2] = text(`<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] /Count ${nPages} >>`);
  objs[3] = text(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
  objs[4] = text(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);
  objs[5] = text(`<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>`);
  pages.forEach((ops, i) => {
    const content = ops.join("\n"); const cb = enc.encode(content);
    objs[pageObj(i)] = text(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contObj(i)} 0 R >>`);
    objs[contObj(i)] = new Uint8Array([...text(`<< /Length ${cb.length} >>\nstream\n`), ...cb, ...text(`\nendstream`)]);
  });
  const chunks: Uint8Array[] = [text("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")]; const offsets: number[] = []; let pos = chunks[0].length;
  for (let n = 1; n < objs.length; n++) { offsets[n] = pos; const head = text(`${n} 0 obj\n`), tail = text(`\nendobj\n`); chunks.push(head, objs[n], tail); pos += head.length + objs[n].length + tail.length; }
  const xrefPos = pos; const count = objs.length;
  let xr = `xref\n0 ${count}\n0000000000 65535 f \n`; for (let n = 1; n < count; n++) xr += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  xr += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`; chunks.push(text(xr));
  const out = new Uint8Array(chunks.reduce((a, b) => a + b.length, 0)); let p = 0; for (const c of chunks) { out.set(c, p); p += c.length; } return out;
}

// ---------------- runtime structural validation (run BEFORE success is reported) ----------------
export type OfficeKind = "docx" | "xlsx" | "pdf";
export function validateOffice(kind: OfficeKind, bytes: Uint8Array): { ok: true } | { ok: false; reason: string } {
  try {
    if (kind === "pdf") {
      const s = new TextDecoder("latin1").decode(bytes);
      if (!s.startsWith("%PDF-1.")) return { ok: false, reason: "missing PDF header" };
      if (!s.trimEnd().endsWith("%%EOF")) return { ok: false, reason: "missing %%EOF" };
      const sx = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(s); if (!sx) return { ok: false, reason: "missing startxref" };
      if (s.slice(+sx[1], +sx[1] + 4) !== "xref") return { ok: false, reason: "startxref does not point at the xref table" };
      const m = /xref\n0 (\d+)\n/.exec(s.slice(+sx[1])); const n = m ? +m[1] : 0;
      const entries = [...s.slice(+sx[1]).matchAll(/(\d{10}) 00000 n /g)];
      if (!n || entries.length !== n - 1) return { ok: false, reason: "xref entry count mismatch" };
      for (let i = 0; i < entries.length; i++) if (!s.slice(+entries[i][1]).startsWith(`${i + 1} 0 obj`)) return { ok: false, reason: `xref offset wrong for object ${i + 1}` };
      return { ok: true };
    }
    const list = zipList(bytes); const names = new Set(list.map((e) => e.name));
    const bad = list.find((e) => !e.crcOk); if (bad) return { ok: false, reason: `CRC mismatch in ${bad.name}` };
    const required = kind === "docx" ? ["[Content_Types].xml", "_rels/.rels", "word/document.xml"] : ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/worksheets/sheet1.xml"];
    const missing = required.find((r) => !names.has(r)); if (missing) return { ok: false, reason: `missing part ${missing}` };
    return { ok: true };
  } catch (e) { return { ok: false, reason: e instanceof Error ? e.message : "invalid file" }; }
}
