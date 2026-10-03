import { describe, expect, it } from "vitest";
import { fetchAllCursorPages, mergeCursorPage } from "@/lib/capability-data";
import { resolveSettingsStorageState } from "@/shared/secure-settings-contract";

describe("mobile capability data utilities", () => {
  it("fetches cursor pages until completion", async () => {
    const pages = [
      { items: [{ id: "a" }], nextCursor: "next", hasMore: true },
      { items: [{ id: "b" }], nextCursor: null, hasMore: false },
    ];
    const result = await fetchAllCursorPages(async ({ cursor }) => pages[cursor === null ? 0 : 1]);
    expect(result.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("rejects a cursor that does not advance", async () => {
    await expect(fetchAllCursorPages(async () => ({ items: [{ id: "a" }], nextCursor: "same", hasMore: true }), { maxPages: 2 })).rejects.toThrow("Cursor did not advance");
  });

  it("merges pages without duplicating entities", () => {
    const result = mergeCursorPage({ items: [{ id: "a", name: "old" }], nextCursor: "x", hasMore: true }, { items: [{ id: "a", name: "new" }, { id: "b", name: "two" }], nextCursor: null, hasMore: false });
    expect(result.items).toEqual([{ id: "a", name: "new" }, { id: "b", name: "two" }]);
  });

  it("reports a fallback settings state on web", () => {
    expect(resolveSettingsStorageState("web")).toBe("fallback");
    expect(resolveSettingsStorageState("ios")).toBe("secure");
  });
});
