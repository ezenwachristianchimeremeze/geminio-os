import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

export type LocalPersistenceState = "sqlite" | "async-storage";

let database: SQLite.SQLiteDatabase | null = null;

function getDatabase() {
  if (Platform.OS === "web") return null;
  if (!database) {
    database = SQLite.openDatabaseSync("geminio-local.db");
    database.execSync("CREATE TABLE IF NOT EXISTS local_kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL)");
  }
  return database;
}

export function getLocalPersistenceState(): LocalPersistenceState {
  return getDatabase() ? "sqlite" : "async-storage";
}

export async function writeLocalJson<T>(key: string, value: T) {
  const serialized = JSON.stringify(value);
  const db = getDatabase();
  if (db) {
    db.runSync("INSERT OR REPLACE INTO local_kv (key, value, updated_at) VALUES (?, ?, ?)", key, serialized, Date.now());
    return;
  }
  await AsyncStorage.setItem(`geminio:${key}`, serialized);
}

export async function readLocalJson<T>(key: string): Promise<T | null> {
  const db = getDatabase();
  if (db) {
    const row = db.getFirstSync<{ value: string }>("SELECT value FROM local_kv WHERE key = ? LIMIT 1", key);
    if (!row?.value) return null;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return null;
    }
  }
  const serialized = await AsyncStorage.getItem(`geminio:${key}`);
  if (!serialized) return null;
  try {
    return JSON.parse(serialized) as T;
  } catch {
    return null;
  }
}

export async function deleteLocalJson(key: string) {
  const db = getDatabase();
  if (db) {
    db.runSync("DELETE FROM local_kv WHERE key = ?", key);
    return;
  }
  await AsyncStorage.removeItem(`geminio:${key}`);
}
