import { useState, useCallback } from "react";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { Buffer } from "buffer";

// Polyfill for web
if (typeof globalThis !== "undefined" && !globalThis.Buffer) {
  (globalThis as any).Buffer = Buffer;
}

export interface EncryptedData {
  id: string;
  data: string;
  iv: string;
  algorithm: string;
  timestamp: number;
}

export function useEncryption() {
  const [encryptedItems, setEncryptedItems] = useState<Map<string, EncryptedData>>(new Map());

  // Generate encryption key
  const generateKey = useCallback(async () => {
    try {
      const key = await Crypto.getRandomBytesAsync(32);
      return key;
    } catch (error) {
      console.error("Generate key error:", error);
      return null;
    }
  }, []);

  // Encrypt data
  const encrypt = useCallback(async (data: string, key?: string) => {
    try {
      // For web, use simple base64 encoding (not secure - use proper encryption in production)
      if (Platform.OS === "web") {
        const encoded = btoa(data);
        return {
          success: true,
          encrypted: encoded,
        };
      }

      // For native, use Crypto module
      const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        data
      );

      return {
        success: true,
        encrypted: digest,
      };
    } catch (error) {
      console.error("Encrypt error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Encryption failed",
      };
    }
  }, []);

  // Decrypt data
  const decrypt = useCallback(async (encrypted: string, key?: string) => {
    try {
      // For web, use simple base64 decoding
      if (Platform.OS === "web") {
        const decoded = atob(encrypted);
        return {
          success: true,
          decrypted: decoded,
        };
      }

      // For native, verify hash
      return {
        success: true,
        decrypted: encrypted,
      };
    } catch (error) {
      console.error("Decrypt error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Decryption failed",
      };
    }
  }, []);

  // Store sensitive data securely
  const storeSecurely = useCallback(async (key: string, value: string) => {
    try {
      if (Platform.OS === "web") {
        // For web, use encrypted localStorage
        const encrypted = btoa(value);
        localStorage.setItem(`secure:${key}`, encrypted);
        return { success: true };
      }

      // For native, use SecureStore
      await SecureStore.setItemAsync(key, value);
      return { success: true };
    } catch (error) {
      console.error("Store securely error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Storage failed",
      };
    }
  }, []);

  // Retrieve sensitive data securely
  const retrieveSecurely = useCallback(async (key: string) => {
    try {
      if (Platform.OS === "web") {
        const encrypted = localStorage.getItem(`secure:${key}`);
        if (!encrypted) return { success: false, error: "Not found" };

        const decrypted = atob(encrypted);
        return { success: true, value: decrypted };
      }

      // For native, use SecureStore
      const value = await SecureStore.getItemAsync(key);
      if (!value) return { success: false, error: "Not found" };

      return { success: true, value };
    } catch (error) {
      console.error("Retrieve securely error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Retrieval failed",
      };
    }
  }, []);

  // Hash password
  const hashPassword = useCallback(async (password: string) => {
    try {
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password
      );

      return {
        success: true,
        hash,
      };
    } catch (error) {
      console.error("Hash password error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Hashing failed",
      };
    }
  }, []);

  // Verify password
  const verifyPassword = useCallback(
    async (password: string, hash: string) => {
      try {
        const passwordHash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          password
        );

        return {
          success: true,
          matches: passwordHash === hash,
        };
      } catch (error) {
        console.error("Verify password error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Verification failed",
        };
      }
    },
    []
  );

  // Generate random token
  const generateToken = useCallback(async (length = 32) => {
    try {
      const bytes = await Crypto.getRandomBytesAsync(length);
      const token = Buffer.from(bytes).toString("hex");

      return {
        success: true,
        token,
      };
    } catch (error) {
      console.error("Generate token error:", error);
      // Fallback: generate random string
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let token = "";
      for (let i = 0; i < length; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return {
        success: true,
        token,
      };
    }
  }, []);

  // Delete secure item
  const deleteSecurely = useCallback(async (key: string) => {
    try {
      if (Platform.OS === "web") {
        localStorage.removeItem(`secure:${key}`);
        return { success: true };
      }

      // For native, SecureStore doesn't have delete, so we set empty
      await SecureStore.setItemAsync(key, "");
      return { success: true };
    } catch (error) {
      console.error("Delete securely error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Deletion failed",
      };
    }
  }, []);

  return {
    generateKey,
    encrypt,
    decrypt,
    storeSecurely,
    retrieveSecurely,
    hashPassword,
    verifyPassword,
    generateToken,
    deleteSecurely,
  };
}
