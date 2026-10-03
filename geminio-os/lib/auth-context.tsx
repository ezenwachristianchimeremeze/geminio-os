import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AuthMethod = 'faceId' | 'fingerprint' | 'pin' | 'none';

interface AuthContextType {
  isAuthenticated: boolean;
  authMethod: AuthMethod;
  isLoading: boolean;
  biometricsAvailable: {
    faceId: boolean;
    fingerprint: boolean;
  };
  authenticate: (method: AuthMethod, pin?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setAuthMethod: (method: AuthMethod) => Promise<void>;
  setPIN: (pin: string) => Promise<void>;
  verifyPIN: (pin: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to safely get item from AsyncStorage with timeout
async function safeAsyncStorageGetItem(key: string, timeoutMs: number = 5000): Promise<string | null> {
  try {
    const promise = AsyncStorage.getItem(key);
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error(`AsyncStorage timeout for key: ${key}`)), timeoutMs)
    );
    return await Promise.race([promise, timeoutPromise]);
  } catch (error) {
    console.warn(`[Auth] Failed to get ${key} from AsyncStorage:`, error);
    return null;
  }
}

// Helper function to safely set item in AsyncStorage with timeout
async function safeAsyncStorageSetItem(key: string, value: string, timeoutMs: number = 5000): Promise<void> {
  try {
    const promise = AsyncStorage.setItem(key, value);
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error(`AsyncStorage timeout for key: ${key}`)), timeoutMs)
    );
    await Promise.race([promise, timeoutPromise]);
  } catch (error) {
    console.warn(`[Auth] Failed to set ${key} in AsyncStorage:`, error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMethod, setAuthMethodState] = useState<AuthMethod>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [biometricsAvailable, setBiometricsAvailable] = useState({
    faceId: false,
    fingerprint: false,
  });

  // Initialize auth on app start
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check biometric availability - wrap in try-catch
        try {
          const compatible = await LocalAuthentication.hasHardwareAsync();
          if (compatible) {
            const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
            setBiometricsAvailable({
              faceId: types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
              fingerprint: types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT),
            });
          }
        } catch (bioError) {
          console.warn('[Auth] Biometric check failed:', bioError);
          // Continue without biometrics
          setBiometricsAvailable({ faceId: false, fingerprint: false });
        }

        // Check stored auth method with timeout
        const storedAuthMethod = await safeAsyncStorageGetItem('authMethod');
        if (storedAuthMethod) {
          setAuthMethodState(storedAuthMethod as AuthMethod);
        }

        // Check if user was previously authenticated with timeout
        const wasAuthenticated = await safeAsyncStorageGetItem('wasAuthenticated');
        if (wasAuthenticated === 'true' && storedAuthMethod && storedAuthMethod !== 'none') {
          // Auto-authenticate if biometric was previously set up
          if (storedAuthMethod === 'faceId' || storedAuthMethod === 'fingerprint') {
            const success = await authenticateBiometric(storedAuthMethod);
            if (success) {
              setIsAuthenticated(true);
            }
          }
        }
      } catch (error) {
        console.error('[Auth] Initialization error:', error);
        // Continue without auth - user can authenticate manually
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const authenticateBiometric = async (method: AuthMethod): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        disableDeviceFallback: false,
      });
      return result.success;
    } catch (error) {
      console.warn('[Auth] Biometric auth error:', error);
      return false;
    }
  };

  const authenticate = async (method: AuthMethod, pin?: string): Promise<boolean> => {
    try {
      if (method === 'faceId' || method === 'fingerprint') {
        const success = await authenticateBiometric(method);
        if (success) {
          setIsAuthenticated(true);
          await safeAsyncStorageSetItem('wasAuthenticated', 'true');
          await safeAsyncStorageSetItem('authMethod', method);
          setAuthMethodState(method);
        }
        return success;
      } else if (method === 'pin' && pin) {
        try {
          const storedPin = await SecureStore.getItemAsync('userPin');
          if (storedPin === pin) {
            setIsAuthenticated(true);
            await safeAsyncStorageSetItem('wasAuthenticated', 'true');
            await safeAsyncStorageSetItem('authMethod', 'pin');
            setAuthMethodState('pin');
            return true;
          }
        } catch (secureStoreError) {
          console.warn('[Auth] SecureStore error:', secureStoreError);
        }
        return false;
      } else if (method === 'none') {
        setIsAuthenticated(true);
        await safeAsyncStorageSetItem('wasAuthenticated', 'true');
        await safeAsyncStorageSetItem('authMethod', 'none');
        setAuthMethodState('none');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Auth] Authentication error:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      setIsAuthenticated(false);
      await safeAsyncStorageSetItem('wasAuthenticated', 'false');
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    }
  };

  const setAuthMethod = async (method: AuthMethod) => {
    try {
      await safeAsyncStorageSetItem('authMethod', method);
      setAuthMethodState(method);
    } catch (error) {
      console.error('[Auth] Set auth method error:', error);
    }
  };

  const setPIN = async (pin: string) => {
    try {
      await SecureStore.setItemAsync('userPin', pin);
      await setAuthMethod('pin');
    } catch (error) {
      console.error('[Auth] Set PIN error:', error);
    }
  };

  const verifyPIN = async (pin: string): Promise<boolean> => {
    try {
      const storedPin = await SecureStore.getItemAsync('userPin');
      return storedPin === pin;
    } catch (error) {
      console.error('[Auth] Verify PIN error:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        authMethod,
        isLoading,
        biometricsAvailable,
        authenticate,
        logout,
        setAuthMethod,
        setPIN,
        verifyPIN,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
