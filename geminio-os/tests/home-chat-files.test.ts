import { describe, expect, it } from "vitest";
import { csvCell, FileGenError, generateFile, tablesToCsv, verifyStored } from "../server/home-chat/files";

const table = "Here you go:\n\n| Name | Note |\n|---|---|\n| Ana | says \"hi\", ok |\n| =SUM(A1) | **bold** [1] |\n";
describe("file generation", () => {
  it("turns the first markdown table into RFC-4180 CSV with formula guarding", () => {
    expect(tablesToCsv(table)).toBe('Name,Note\r\nAna,"says ""hi"", ok"\r\n\'=SUM(A1),bold\r\n');
    expect(csvCell("-1+2")).toBe("'-1+2"); expect(csvCell("plain")).toBe("plain"); expect(csvCell("a\nb")).toBe('"a\nb"');
  });
  it("csv requires a table and says so; empty content is refused", () => {
    expect(() => generateFile({ content: "no table here", format: "csv", title: "x" })).toThrow(FileGenError);
    try { generateFile({ content: "no table", format: "csv", title: "x" }); } catch (e) { expect((e as FileGenError).code).toBe("NO_TABLE"); }
    expect(() => generateFile({ content: "  ", format: "md", title: "x" })).toThrow("nothing");
  });
  it("md keeps content, txt strips markup, csv has a BOM; sizes and hashes are real", () => {
    const md = generateFile({ content: "# Hi\n\n**x**", format: "md", title: "My Chat!" });
    expect(md.filename).toBe("My-Chat.md"); expect(new TextDecoder().decode(md.bytes)).toBe("# Hi\n\n**x**"); expect(md.sizeBytes).toBe(md.bytes.length);
    expect(new TextDecoder().decode(generateFile({ content: "# Hi\n\n**x** `y`", format: "txt", title: "t" }).bytes)).toBe("Hi. x y");
    const csv = generateFile({ content: table, format: "csv", title: "t" });
    expect(csv.bytes[0]).toBe(0xef); expect(csv.mimeType).toBe("text/csv");
  });
  it("sanitises the filename and enforces the size limit", () => {
    expect(generateFile({ content: "x", format: "md", title: "../../etc/passwd" }).filename).toBe("etcpasswd.md");
    expect(() => generateFile({ content: "x".repeat(2 * 1024 * 1024 + 1), format: "md", title: "t" })).toThrow("2 MB");
  });
  it("verifyStored detects any difference between generated and stored bytes", () => {
    const g = generateFile({ content: "hello", format: "md", title: "t" });
    expect(verifyStored(g, g.bytes)).toBe(true);
    expect(verifyStored(g, new TextEncoder().encode("hellO"))).toBe(false); expect(verifyStored(g, new Uint8Array(0))).toBe(false);
  });
});
