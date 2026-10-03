import { useState, useCallback } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface BiometricSession {
  id: string;
  authenticated: boolean;
  timestamp: number;
  expiresAt: number;
  method: "fingerprint" | "face" | "iris" | "pin";
}

export function useBiometricReauth() {
  const [session, setSession] = useState<BiometricSession | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [availableMethods, setAvailableMethods] = useState<string[]>([]);

  const checkAvailableMethods = useCallback(async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) {
        return { success: true, methods: [] };
      }

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const methods = types.map((type) => {
        switch (type) {
          case LocalAuthentication.AuthenticationType.FINGERPRINT:
            return "fingerprint";
          case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
            return "face";
          case LocalAuthentication.AuthenticationType.IRIS:
            return "iris";
          default:
            return "unknown";
        }
      });

      setAvailableMethods(methods);
      return { success: true, methods };
    } catch (error) {
      console.error("Check methods error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check methods",
      };
    }
  }, []);

  const authenticate = useCallback(
    async (reason = "Authenticate to access Geminio OS") => {
      try {
        setIsAuthenticating(true);

        const result = await LocalAuthentication.authenticateAsync({
          disableDeviceFallback: false,
        });

        if (result.success) {
          const sessionDuration = 30 * 60 * 1000;
          const newSession: BiometricSession = {
            id: `session-${Date.now()}`,
            authenticated: true,
            timestamp: Date.now(),
            expiresAt: Date.now() + sessionDuration,
            method: "fingerprint",
          };

          setSession(newSession);

          await AsyncStorage.setItem(
            "biometric_session",
            JSON.stringify(newSession)
          );

          return { success: true, session: newSession };
        }

        return { success: false, error: "Authentication failed" };
      } catch (error) {
        console.error("Authenticate error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Authentication failed",
        };
      } finally {
        setIsAuthenticating(false);
      }
    },
    []
  );

  const isSessionValid = useCallback(() => {
    if (!session) return false;

    const now = Date.now();
    return session.authenticated && now < session.expiresAt;
  }, [session]);

  const requireReauth = useCallback(async () => {
    if (!isSessionValid()) {
      const result = await authenticate();
      return result;
    }

    return { success: true, session };
  }, [isSessionValid, authenticate, session]);

  const logout = useCallback(async () => {
    try {
      setSession(null);
      await AsyncStorage.removeItem("biometric_session");
      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Logout failed",
      };
    }
  }, []);

  const getSessionInfo = useCallback(() => {
    if (!session) {
      return { authenticated: false, timeRemaining: 0 };
    }

    const now = Date.now();
    const timeRemaining = Math.max(0, session.expiresAt - now);

    return {
      authenticated: session.authenticated && timeRemaining > 0,
      timeRemaining,
      method: session.method,
    };
  }, [session]);

  const extendSession = useCallback(async () => {
    if (!session) {
      return { success: false, error: "No active session" };
    }

    try {
      const sessionDuration = 30 * 60 * 1000;
      const extended: BiometricSession = {
        ...session,
        expiresAt: Date.now() + sessionDuration,
      };

      setSession(extended);
      await AsyncStorage.setItem(
        "biometric_session",
        JSON.stringify(extended)
      );

      return { success: true, session: extended };
    } catch (error) {
      console.error("Extend session error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to extend session",
      };
    }
  }, [session]);

  return {
    session,
    isAuthenticating,
    availableMethods,
    checkAvailableMethods,
    authenticate,
    isSessionValid,
    requireReauth,
    logout,
    getSessionInfo,
    extendSession,
  };
}
