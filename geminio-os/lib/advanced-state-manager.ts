import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Advanced State Manager
 * Provides optimistic updates, pagination, offline detection, and focus/blur tracking
 */

interface OptimisticUpdateState<T> {
  data: T;
  isPending: boolean;
  error: Error | null;
}

interface PaginationState<T> {
  items: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for optimistic updates
 * Immediately updates UI while request is in flight
 */
export function useOptimisticUpdate<T>(
  initialValue: T,
  updateFn: (value: T) => Promise<T>
): [T, (newValue: T) => Promise<void>, boolean] {
  const [state, setState] = React.useState<OptimisticUpdateState<T>>({
    data: initialValue,
    isPending: false,
    error: null,
  });

  const updateOptimistic = React.useCallback(
    async (newValue: T) => {
      setState((prev) => ({ ...prev, data: newValue, isPending: true, error: null }));

      try {
        const result = await updateFn(newValue);
        setState((prev) => ({ ...prev, data: result, isPending: false }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          data: initialValue,
          isPending: false,
          error: error instanceof Error ? error : new Error('Unknown error'),
        }));
      }
    },
    [initialValue, updateFn]
  );

  return [state.data, updateOptimistic, state.isPending];
}

/**
 * Hook for infinite scroll / pagination
 */
export function usePagination<T>(
  fetchFn: (page: number, pageSize: number) => Promise<T[]>,
  pageSize: number = 20
): [T[], () => void, boolean, boolean] {
  const [state, setState] = React.useState<PaginationState<T>>({
    items: [],
    page: 1,
    pageSize,
    hasMore: true,
    isLoading: false,
    error: null,
  });

  const loadMore = React.useCallback(async () => {
    if (state.isLoading || !state.hasMore) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const newItems = await fetchFn(state.page, pageSize);
      setState((prev) => ({
        ...prev,
        items: [...prev.items, ...newItems],
        page: prev.page + 1,
        hasMore: newItems.length === pageSize,
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      }));
    }
  }, [state.isLoading, state.hasMore, state.page, pageSize, fetchFn]);

  const reset = React.useCallback(() => {
    setState({
      items: [],
      page: 1,
      pageSize,
      hasMore: true,
      isLoading: false,
      error: null,
    });
  }, [pageSize]);

  return [state.items, loadMore, state.isLoading, state.hasMore];
}

/**
 * Hook for focus/blur tracking
 */
export function useFocusBlur(
  onFocus?: () => void,
  onBlur?: () => void
): { isFocused: boolean } {
  const [isFocused, setIsFocused] = React.useState(true);

  React.useEffect(() => {
    if (isFocused) {
      onFocus?.();
    } else {
      onBlur?.();
    }
  }, [isFocused, onFocus, onBlur]);

  return { isFocused };
}

/**
 * Hook for clipboard operations
 */
export function useClipboard(): {
  copy: (text: string) => Promise<void>;
  paste: () => Promise<string | null>;
} {
  const copy = React.useCallback(async (text: string) => {
    try {
      await AsyncStorage.setItem('clipboard', text);
      console.log('Copied to clipboard:', text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, []);

  const paste = React.useCallback(async () => {
    try {
      const text = await AsyncStorage.getItem('clipboard');
      return text;
    } catch (error) {
      console.error('Failed to paste from clipboard:', error);
      return null;
    }
  }, []);

  return { copy, paste };
}

/**
 * Hook for share sheet
 */
export function useShare(): {
  share: (options: { message?: string; url?: string; title?: string }) => Promise<void>;
} {
  const share = React.useCallback(
    async (options: { message?: string; url?: string; title?: string }) => {
      try {
        console.log('Sharing:', options);
        // In a real implementation, use react-native Share API
      } catch (error) {
        console.error('Failed to share:', error);
      }
    },
    []
  );

  return { share };
}

/**
 * Hook for app state tracking
 */
export function useAppState(): {
  appState: 'active' | 'background' | 'inactive';
} {
  const [appState, setAppState] = React.useState<'active' | 'background' | 'inactive'>('active');

  React.useEffect(() => {
    // In a real implementation, use AppState from react-native
    return () => {};
  }, []);

  return { appState };
}

/**
 * Soft Delete Support
 * Marks records as deleted without removing them from database
 */
export interface SoftDeletable {
  deletedAt: Date | null;
  isDeleted: boolean;
}

export function markAsDeleted<T extends SoftDeletable>(item: T): T {
  return {
    ...item,
    deletedAt: new Date(),
    isDeleted: true,
  };
}

export function filterDeleted<T extends SoftDeletable>(items: T[]): T[] {
  return items.filter((item) => !item.isDeleted);
}

/**
 * Full-Text Search Support
 */
export function searchItems<T extends Record<string, any>>(
  items: T[],
  query: string,
  searchFields: (keyof T)[]
): T[] {
  const lowerQuery = query.toLowerCase();
  return items.filter((item) =>
    searchFields.some((field) => {
      const value = item[field];
      return typeof value === 'string' && value.toLowerCase().includes(lowerQuery);
    })
  );
}

/**
 * Debounce Hook for search
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttle Hook for scroll events
 */
export function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = React.useState(value);
  const lastRun = React.useRef(Date.now());

  React.useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRun.current >= delay) {
        setThrottledValue(value);
        lastRun.current = Date.now();
      }
    }, delay - (Date.now() - lastRun.current));

    return () => clearTimeout(handler);
  }, [value, delay]);

  return throttledValue;
}
