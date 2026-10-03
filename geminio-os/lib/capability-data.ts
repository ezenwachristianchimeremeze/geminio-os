export type CursorPage<T, C = string> = {
  items: T[];
  nextCursor: C | null;
  hasMore: boolean;
};

export type CursorFetcher<T, C = string> = (input: { cursor: C | null; limit: number }) => Promise<CursorPage<T, C>>;

export async function fetchAllCursorPages<T, C = string>(fetchPage: CursorFetcher<T, C>, options: { limit?: number; maxPages?: number } = {}): Promise<T[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 250));
  const maxPages = Math.max(1, options.maxPages ?? 100);
  const items: T[] = [];
  let cursor: C | null = null;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchPage({ cursor, limit });
    items.push(...result.items);
    if (!result.hasMore || result.nextCursor === null || result.items.length === 0) return items;
    if (Object.is(result.nextCursor, cursor)) throw new Error("Cursor did not advance");
    cursor = result.nextCursor;
  }
  throw new Error("Pagination exceeded the configured page limit");
}

export function mergeCursorPage<T extends { id: string }, C>(current: CursorPage<T, C> | null, next: CursorPage<T, C>): CursorPage<T, C> {
  const map = new Map((current?.items ?? []).map((item) => [item.id, item]));
  for (const item of next.items) map.set(item.id, item);
  return { items: Array.from(map.values()), nextCursor: next.nextCursor, hasMore: next.hasMore };
}
