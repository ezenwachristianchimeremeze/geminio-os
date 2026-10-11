import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDocx, buildPdf, buildXlsx, crc32, validateOffice, zipList, zipStore } from "../server/home-chat/office";
import { FileGenError, generateFile, verifyStored } from "../server/home-chat/files";

const LONG = "word ".repeat(3000);
const md = `# Report\n\nIntro **bold** *it* \`code\` [link](https://e.test/a). Ünï “q” 日本語\n\n- a\n- b\n\n| Region | Revenue |\n|---|---|\n| North | 1200 |\n| South | =SUM(A1) |\n\n\`\`\`ts\nconst a = (1);\n\`\`\`\n\n${LONG}`;

describe("zip container", () => {
  it("crc32 matches the standard check value and zip round-trips with valid CRCs", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    const z = zipStore([{ name: "a.txt", data: new TextEncoder().encode("hello") }, { name: "dir/b.xml", data: new TextEncoder().encode("<x/>") }]);
    expect(zipList(z)).toEqual([{ name: "a.txt", crcOk: true, size: 5 }, { name: "dir/b.xml", crcOk: true, size: 4 }]);
  });
  it("is reproducible and detects corruption", () => {
    const a = zipStore([{ name: "a", data: new Uint8Array([1, 2, 3]) }]); const b = zipStore([{ name: "a", data: new Uint8Array([1, 2, 3]) }]);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    const bad = new Uint8Array(a); bad[32] ^= 0xff; expect(zipList(bad)[0].crcOk).toBe(false);
    expect(() => zipList(new Uint8Array([1, 2, 3]))).toThrow();
  });
});

describe("office writers + runtime validators", () => {
  const docx = buildDocx(md, "Report"), xlsx = buildXlsx(md)!, pdf = buildPdf(md, "Report");
  it("produce files that pass structural validation", () => {
    expect(validateOffice("docx", docx)).toEqual({ ok: true }); expect(validateOffice("xlsx", xlsx)).toEqual({ ok: true }); expect(validateOffice("pdf", pdf)).toEqual({ ok: true });
  });
  it("validators reject truncated/corrupted output (so a bad file is never reported as success)", () => {
    expect(validateOffice("pdf", pdf.slice(0, pdf.length - 30)).ok).toBe(false);
    expect(validateOffice("docx", docx.slice(0, 100)).ok).toBe(false);
    const c = new Uint8Array(docx); c[60] ^= 0x55; expect(validateOffice("docx", c).ok).toBe(false);
    expect(validateOffice("xlsx", docx).ok).toBe(false); // wrong kind: required parts missing
    expect(validateOffice("pdf", new TextEncoder().encode("not a pdf")).ok).toBe(false);
  });
  it("xlsx needs a table; every table becomes a sheet; strings are never formulas", () => {
    expect(buildXlsx("no table")).toBeNull();
    const two = buildXlsx("| a |\n|---|\n| 1 |\n\ntext\n\n| b |\n|---|\n| 2 |")!; expect(zipList(two).filter((e) => e.name.startsWith("xl/worksheets/")).length).toBe(2);
  });
  it("escapes XML-hostile content and survives huge words / control characters", () => {
    const d = buildDocx("# <script>&\"'\n\nx\u0000y \u0007 " + "A".repeat(3000), "<t>"); expect(validateOffice("docx", d)).toEqual({ ok: true });
    const p = buildPdf("(unbalanced \\ parens ) and " + "B".repeat(3000), "t"); expect(validateOffice("pdf", p)).toEqual({ ok: true });
  });
  it("pdf paginates long content", () => { expect(new TextDecoder("latin1").decode(pdf).match(/\/Type \/Page /g)!.length).toBeGreaterThan(1); });
});

describe("generateFile with new formats", () => {
  it("returns validated, correctly-typed bytes with real hashes", () => {
    for (const [fmt, mime] of [["pdf", "application/pdf"], ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]] as const) {
      const g = generateFile({ content: md, format: fmt, title: "My Report" });
      expect(g.mimeType).toBe(mime); expect(g.filename).toBe(`My-Report.${fmt}`); expect(g.sizeBytes).toBe(g.bytes.length); expect(verifyStored(g, g.bytes)).toBe(true);
    }
  });
  it("xlsx without a table and empty content are refused with a clear reason", () => {
    expect(() => generateFile({ content: "plain text", format: "xlsx", title: "t" })).toThrow(FileGenError);
    expect(() => generateFile({ content: " ", format: "pdf", title: "t" })).toThrow("nothing");
  });
});

// Cross-validation with INDEPENDENT parsers (python-docx, openpyxl, pypdf). Skipped automatically where they are not installed.
const py = (code: string, args: string[]) => spawnSync("python3", ["-c", code, ...args], { encoding: "utf8" });
const haveParsers = (() => { const r = py("import docx, openpyxl, pypdf", []); return r.status === 0; })();
describe.skipIf ? describe.skipIf(!haveParsers)("independent parser cross-validation", () => body()) : describe("independent parser cross-validation", () => { if (haveParsers) body(); });
function body() {
  const dir = mkdtempSync(join(tmpdir(), "office-"));
  it("python-docx reads headings, text, unicode and a real table", () => {
    writeFileSync(join(dir, "t.docx"), buildDocx(md, "Report"));
    const r = py("import sys,docx;d=docx.Document(sys.argv[1]);print(d.paragraphs[1].style.name);print(any('日本語' in p.text for p in d.paragraphs));print(d.tables[0].rows[2].cells[1].text)", [join(dir, "t.docx")]);
    expect(r.stdout.trim().split("\n")).toEqual(["Heading 1", "True", "=SUM(A1)"]);
  });
  it("openpyxl reads numbers as numbers and formula-looking text as a string", () => {
    writeFileSync(join(dir, "t.xlsx"), buildXlsx(md)!);
    const r = py("import sys,openpyxl;ws=openpyxl.load_workbook(sys.argv[1]).active;print(type(ws['B2'].value).__name__);print(ws['B3'].data_type);print(ws['A1'].value)", [join(dir, "t.xlsx")]);
    expect(r.stdout.trim().split("\n")).toEqual(["int", "s", "Region"]);
  });
  it("pypdf extracts the text on every page", () => {
    writeFileSync(join(dir, "t.pdf"), buildPdf(md, "Report"));
    const r = py("import sys,pypdf;r=pypdf.PdfReader(sys.argv[1]);t=' '.join(p.extract_text() for p in r.pages);print(len(r.pages)>1);print('const a = (1);' in t);print('Region  |  Revenue' in t)", [join(dir, "t.pdf")]);
    expect(r.stdout.trim().split("\n")).toEqual(["True", "True", "True"]);
  });
}
