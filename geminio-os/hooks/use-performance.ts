import { useCallback, useRef, useEffect, useState } from "react";
import { Platform } from "react-native";

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

export function usePerformance() {
  const metricsRef = useRef<Map<string, PerformanceMetric>>(new Map());
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);

  // Start measuring
  const startMeasure = useCallback((name: string) => {
    metricsRef.current.set(name, {
      name,
      startTime: Date.now(),
    });
  }, []);

  // End measuring
  const endMeasure = useCallback((name: string) => {
    const metric = metricsRef.current.get(name);
    if (metric) {
      metric.endTime = Date.now();
      metric.duration = metric.endTime - metric.startTime;

      // Log slow operations
      if (metric.duration > 1000) {
        console.warn(`⚠️ Slow operation: ${name} took ${metric.duration}ms`);
      }

      setMetrics((prev) => [...prev, metric]);
    }
  }, []);

  // Measure async operation
  const measureAsync = useCallback(
    async <T,>(name: string, fn: () => Promise<T>): Promise<T> => {
      startMeasure(name);
      try {
        const result = await fn();
        endMeasure(name);
        return result;
      } catch (error) {
        endMeasure(name);
        throw error;
      }
    },
    [startMeasure, endMeasure]
  );

  // Measure sync operation
  const measureSync = useCallback(
    <T,>(name: string, fn: () => T): T => {
      startMeasure(name);
      try {
        const result = fn();
        endMeasure(name);
        return result;
      } catch (error) {
        endMeasure(name);
        throw error;
      }
    },
    [startMeasure, endMeasure]
  );

  // Get average duration for metric
  const getAverageDuration = useCallback(
    (name: string) => {
      const relevant = metrics.filter((m) => m.name === name && m.duration);
      if (relevant.length === 0) return 0;

      const sum = relevant.reduce((acc, m) => acc + (m.duration || 0), 0);
      return sum / relevant.length;
    },
    [metrics]
  );

  // Get slowest operations
  const getSlowestOperations = useCallback(
    (limit = 10) => {
      return [...metrics]
        .sort((a, b) => (b.duration || 0) - (a.duration || 0))
        .slice(0, limit);
    },
    [metrics]
  );

  // Clear metrics
  const clearMetrics = useCallback(() => {
    metricsRef.current.clear();
    setMetrics([]);
  }, []);

  // Get performance report
  const getReport = useCallback(() => {
    const operationNames = new Set(metrics.map((m) => m.name));
    const report: Record<string, any> = {};

    operationNames.forEach((name: string) => {
      const relevant = metrics.filter((m) => m.name === name && m.duration);
      if (relevant.length > 0) {
        const durations = relevant.map((m) => m.duration || 0);
        report[name] = {
          count: relevant.length,
          average: durations.reduce((a, b) => a + b, 0) / durations.length,
          min: Math.min(...durations),
          max: Math.max(...durations),
        };
      }
    });

    return report;
  }, [metrics]);

  // Log performance report
  const logReport = useCallback(() => {
    const report = getReport();
    console.log("📊 Performance Report:", report);
  }, [getReport]);

  return {
    startMeasure,
    endMeasure,
    measureAsync,
    measureSync,
    getAverageDuration,
    getSlowestOperations,
    clearMetrics,
    getReport,
    logReport,
    metrics,
  };
}

// Debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Throttle hook
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdated = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();

    if (now >= lastUpdated.current + interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const handler = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, interval);

      return () => {
        clearTimeout(handler);
      };
    }
  }, [value, interval]);

  return throttledValue;
}

// Memoize hook
export function useMemoize<T extends (...args: any[]) => any>(fn: T): T {
  const cacheRef = useRef<Map<string, any>>(new Map());

  return useCallback(
    (...args: any[]) => {
      const key = JSON.stringify(args);
      if (cacheRef.current.has(key)) {
        return cacheRef.current.get(key);
      }

      const result = fn(...args);
      cacheRef.current.set(key, result);

      // Limit cache size
      if (cacheRef.current.size > 100) {
        const firstKey = cacheRef.current.keys().next().value as string | undefined;
        if (firstKey) {
          cacheRef.current.delete(firstKey);
        }
      }

      return result;
    },
    [fn]
  ) as T;
}
