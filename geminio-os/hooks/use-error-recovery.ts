import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ErrorLog {
  id: string;
  message: string;
  stack?: string;
  timestamp: number;
  context?: Record<string, any>;
  resolved: boolean;
  attempts: number;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number; // milliseconds
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

export function useErrorRecovery() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);

  // Log error
  const logError = useCallback(
    async (
      message: string,
      stack?: string,
      context?: Record<string, any>
    ) => {
      try {
        const error: ErrorLog = {
          id: `error-${Date.now()}`,
          message,
          stack,
          timestamp: Date.now(),
          context,
          resolved: false,
          attempts: 0,
        };

        setErrors((prev) => [error, ...prev]);

        // Save to storage
        const stored = await AsyncStorage.getItem("error_logs");
        const allErrors = stored ? JSON.parse(stored) : [];
        await AsyncStorage.setItem(
          "error_logs",
          JSON.stringify([...allErrors, error])
        );

        return error;
      } catch (err) {
        console.error("Error logging error:", err);
        return null;
      }
    },
    []
  );

  // Retry with exponential backoff
  const retryWithBackoff = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      config: Partial<RetryConfig> = {}
    ): Promise<{ success: boolean; result?: T; error?: string; attempts: number }> => {
      const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
      let lastError: any;
      let delay = finalConfig.initialDelay;

      for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
        try {
          const result = await fn();
          return { success: true, result, attempts: attempt };
        } catch (error) {
          lastError = error;

          if (attempt < finalConfig.maxAttempts) {
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, delay));

            // Calculate next delay with exponential backoff
            delay = Math.min(
              delay * finalConfig.backoffMultiplier,
              finalConfig.maxDelay
            );
          }
        }
      }

      const errorMessage = lastError instanceof Error ? lastError.message : "Unknown error";
      await logError(errorMessage, lastError?.stack, { fn: fn.toString() });

      return {
        success: false,
        error: errorMessage,
        attempts: finalConfig.maxAttempts,
      };
    },
    [logError]
  );

  // Resolve error
  const resolveError = useCallback(
    async (errorId: string) => {
      try {
        const updated = errors.map((e) =>
          e.id === errorId ? { ...e, resolved: true } : e
        );

        setErrors(updated);

        await AsyncStorage.setItem("error_logs", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Resolve error error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to resolve error",
        };
      }
    },
    [errors]
  );

  // Get unresolved errors
  const getUnresolvedErrors = useCallback(() => {
    return errors.filter((e) => !e.resolved);
  }, [errors]);

  // Get error statistics
  const getErrorStats = useCallback(() => {
    const totalErrors = errors.length;
    const unresolvedErrors = errors.filter((e) => !e.resolved).length;
    const uniqueMessages = new Set(errors.map((e) => e.message)).size;

    return {
      totalErrors,
      unresolvedErrors,
      resolvedErrors: totalErrors - unresolvedErrors,
      uniqueMessages,
      errorRate: totalErrors > 0 ? (unresolvedErrors / totalErrors) * 100 : 0,
    };
  }, [errors]);

  // Clear error logs
  const clearErrorLogs = useCallback(async () => {
    try {
      setErrors([]);
      await AsyncStorage.removeItem("error_logs");
      return { success: true };
    } catch (error) {
      console.error("Clear error logs error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear logs",
      };
    }
  }, []);

  // Export error logs
  const exportErrorLogs = useCallback(() => {
    return JSON.stringify(errors, null, 2);
  }, [errors]);

  // Circuit breaker pattern
  const createCircuitBreaker = useCallback(
    (fn: () => Promise<any>, failureThreshold = 5, timeout = 60000) => {
      let failureCount = 0;
      let lastFailureTime = 0;
      let state: "closed" | "open" | "half-open" = "closed";

      return async () => {
        // Check if circuit should be reset
        if (state === "open" && Date.now() - lastFailureTime > timeout) {
          state = "half-open";
          failureCount = 0;
        }

        if (state === "open") {
          throw new Error("Circuit breaker is open");
        }

        try {
          const result = await fn();

          if (state === "half-open") {
            state = "closed";
            failureCount = 0;
          }

          return result;
        } catch (error) {
          failureCount++;
          lastFailureTime = Date.now();

          if (failureCount >= failureThreshold) {
            state = "open";
          }

          throw error;
        }
      };
    },
    []
  );

  return {
    errors,
    isRecovering,
    logError,
    retryWithBackoff,
    resolveError,
    getUnresolvedErrors,
    getErrorStats,
    clearErrorLogs,
    exportErrorLogs,
    createCircuitBreaker,
  };
}
