/** File/image pickers. Returns base64 + metadata; validation is authoritative on the server. UNVERIFIED on device/browser. */
import { Platform } from "react-native";
export type Picked = { name: string; mimeType: string; dataBase64: string; sizeBytes: number };
export class PickError extends Error {}
const MAX = 10 * 1024 * 1024;

async function toBase64(uri: string, webFile?: File | null): Promise<{ b64: string; size: number }> {
  const blob = webFile ?? (await (await fetch(uri)).blob());
  if (blob.size > MAX) throw new PickError("That file is larger than 10 MB.");
  const b64 = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onerror = () => reject(new PickError("Couldn't read that file.")); r.onload = () => { const s = String(r.result); resolve(s.slice(s.indexOf(",") + 1)); }; r.readAsDataURL(blob); });
  return { b64, size: blob.size };
}

export async function pickDocument(): Promise<Picked | null> {
  const DocumentPicker = await import("expo-document-picker");
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const { b64, size } = await toBase64(a.uri, Platform.OS === "web" ? (a as { file?: File }).file : null);
  return { name: a.name, mimeType: a.mimeType ?? "", dataBase64: b64, sizeBytes: size };
}

export async function pickImage(): Promise<Picked | null> {
  const ImagePicker = await import("expo-image-picker");
  if (Platform.OS !== "web") {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new PickError("Photo library permission was denied. Enable it in Settings to attach images.");
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, allowsMultipleSelection: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const { b64, size } = await toBase64(a.uri);
  return { name: a.fileName ?? `image-${Date.now()}.jpg`, mimeType: a.mimeType ?? "image/jpeg", dataBase64: b64, sizeBytes: size };
}
