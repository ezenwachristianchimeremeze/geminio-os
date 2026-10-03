import { AppState, type AppStateStatus } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";

export function useAppLifecycle({
  onForeground,
  onBackground,
  onBlur,
}: {
  onForeground?: () => void | Promise<void>;
  onBackground?: () => void | Promise<void>;
  onBlur?: () => void | Promise<void>;
} = {}) {
  const [status, setStatus] = useState<AppStateStatus>(AppState.currentState);
  const previousStatus = useRef<AppStateStatus>(AppState.currentState);

  const handleStatusChange = useCallback(async (nextStatus: AppStateStatus) => {
    const previous = previousStatus.current;
    previousStatus.current = nextStatus;
    setStatus(nextStatus);
    if (nextStatus === "active" && previous !== "active") await onForeground?.();
    if (nextStatus === "background" || nextStatus === "inactive") await onBackground?.();
    if (nextStatus !== "active") await onBlur?.();
  }, [onBackground, onBlur, onForeground]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextStatus) => {
      void handleStatusChange(nextStatus);
    });
    return () => subscription.remove();
  }, [handleStatusChange]);

  return {
    status,
    isActive: status === "active",
    isInBackground: status === "background",
    isInactive: status === "inactive",
  };
}
