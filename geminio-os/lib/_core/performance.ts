/**
 * Geminio OS - Performance Optimization
 * 
 * Handles:
 * - Message pagination
 * - Response caching
 * - Image lazy loading
 * - Bundle size optimization
 * - Performance monitoring
 */

/**
 * Pagination utilities
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  totalPages: number;
}

export function paginate<T>(
  items: T[],
  page: number = 1,
  pageSize: number = 20
): PaginatedResult<T> {
  const total = items.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedItems = items.slice(start, end);
  const totalPages = Math.ceil(total / pageSize);

  return {
    items: paginatedItems,
    page,
    pageSize,
    total,
    hasMore: page < totalPages,
    totalPages,
  };
}

/**
 * Response caching with TTL
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ResponseCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(key?: string) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export const responseCache = new ResponseCache();

/**
 * Image lazy loading utilities
 */
export interface ImageLoadingConfig {
  width: number;
  height: number;
  placeholder?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export function createImageLoader(config: ImageLoadingConfig) {
  return {
    ...config,
    loading: "lazy" as const,
    decoding: "async" as const,
  };
}

/**
 * Performance monitoring
 */
interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private marks: Map<string, number> = new Map();

  mark(name: string) {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string, metadata?: Record<string, unknown>) {
    const startTime = this.marks.get(startMark);
    if (!startTime) {
      console.warn(`Start mark "${startMark}" not found`);
      return;
    }

    const duration = performance.now() - startTime;
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: new Date(),
      metadata,
    };

    this.metrics.push(metric);
    this.marks.delete(startMark);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }

    return metric;
  }

  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.filter((m) => m.name === name);
    }
    return [...this.metrics];
  }

  getStats(name: string) {
    const metrics = this.metrics.filter((m) => m.name === name);
    if (metrics.length === 0) {
      return null;
    }

    const durations = metrics.map((m) => m.duration);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    return { avg, min, max, count: metrics.length };
  }

  clear() {
    this.metrics = [];
    this.marks.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Bundle size optimization helpers
 */
export function getComponentSize(componentName: string): number {
  // In production, this would read from bundle analysis
  // For now, return estimated sizes
  const sizes: Record<string, number> = {
    "Chat Screen": 45,
    "Advisor Screen": 52,
    "Job Hub": 38,
    "Finance Dashboard": 42,
    "Voice Assistant": 35,
  };
  return sizes[componentName] || 0;
}

export function analyzeBundleSize() {
  const components = [
    "Chat Screen",
    "Advisor Screen",
    "Job Hub",
    "Finance Dashboard",
    "Voice Assistant",
  ];

  const total = components.reduce((sum, comp) => sum + getComponentSize(comp), 0);

  return {
    total,
    components: components.map((comp) => ({
      name: comp,
      size: getComponentSize(comp),
      percentage: (getComponentSize(comp) / total) * 100,
    })),
    recommendation:
      total > 500
        ? "Consider code splitting and lazy loading"
        : "Bundle size is optimized",
  };
}

/**
 * Loading skeleton component helper
 */
export function createLoadingSkeleton(
  itemCount: number = 5,
  height: number = 60
) {
  return Array(itemCount)
    .fill(null)
    .map((_, i) => ({
      id: `skeleton-${i}`,
      height,
      animated: true,
    }));
}

/**
 * Debounce utility for performance
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Throttle utility for performance
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
