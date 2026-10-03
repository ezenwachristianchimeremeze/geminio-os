import { useState, useCallback, useMemo } from "react";

export interface SearchableItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  type: "task" | "goal" | "note" | "message" | "opportunity" | "automation";
  createdAt: Date;
}

interface SearchResult extends SearchableItem {
  relevance: number; // 0-1 score
}

export function useSearch(items: SearchableItem[]) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<{
    types?: string[];
    tags?: string[];
    dateRange?: { from: Date; to: Date };
  }>({});

  // Calculate relevance score for search results
  const calculateRelevance = useCallback((item: SearchableItem, searchQuery: string): number => {
    if (!searchQuery.trim()) return 0;

    const query = searchQuery.toLowerCase();
    let score = 0;

    // Title match (highest priority)
    if (item.title.toLowerCase().includes(query)) {
      score += 0.5;
      // Exact match at start gets bonus
      if (item.title.toLowerCase().startsWith(query)) {
        score += 0.2;
      }
    }

    // Content match
    if (item.content.toLowerCase().includes(query)) {
      score += 0.2;
    }

    // Tag match
    if (item.tags.some((tag) => tag.toLowerCase().includes(query))) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }, []);

  // Filter items based on active filters
  const filterItems = useCallback((itemsToFilter: SearchableItem[]): SearchableItem[] => {
    return itemsToFilter.filter((item) => {
      // Type filter
      if (filters.types && filters.types.length > 0) {
        if (!filters.types.includes(item.type)) return false;
      }

      // Tag filter
      if (filters.tags && filters.tags.length > 0) {
        if (!item.tags.some((tag) => filters.tags!.includes(tag))) return false;
      }

      // Date range filter
      if (filters.dateRange) {
        if (item.createdAt < filters.dateRange.from || item.createdAt > filters.dateRange.to) {
          return false;
        }
      }

      return true;
    });
  }, [filters]);

  // Perform search with filters
  const search = useMemo(() => {
    if (!query.trim() && Object.keys(filters).length === 0) {
      return [];
    }

    let results: SearchResult[] = filterItems(items)
      .map((item) => ({
        ...item,
        relevance: calculateRelevance(item, query),
      }))
      .filter((result) => result.relevance > 0 || Object.keys(filters).length > 0)
      .sort((a, b) => b.relevance - a.relevance);

    return results;
  }, [query, items, filters, filterItems, calculateRelevance]);

  // Get all unique tags from items
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach((item) => {
      item.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [items]);

  // Get all item types
  const allTypes = useMemo(() => {
    const types = new Set<string>();
    items.forEach((item) => {
      types.add(item.type);
    });
    return Array.from(types).sort();
  }, [items]);

  // Add filter
  const addFilter = useCallback(
    (filterType: keyof typeof filters, value: any) => {
      setFilters((prev) => ({
        ...prev,
        [filterType]: value,
      }));
    },
    []
  );

  // Remove filter
  const removeFilter = useCallback((filterType: keyof typeof filters) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[filterType];
      return newFilters;
    });
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery("");
  }, []);

  return {
    query,
    setQuery,
    filters,
    addFilter,
    removeFilter,
    clearFilters,
    clearSearch,
    results: search,
    allTags,
    allTypes,
    hasActiveFilters: Object.keys(filters).length > 0,
  };
}
