import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { homeChatAttachments } from "../../drizzle/schema";
import { getDb } from "../db";
import { storageGet, storageGetSignedUrl, storagePut } from "../storage";
import { AttachmentError, validateAttachment, type LoadedAttachment } from "./attachments";
import { decodeAudio as decodeBase64 } from "./stt";

/** NOT VERIFIED AT RUNTIME: needs MySQL and the storage proxy, neither available in the build sandbox. Validation logic is unit-tested. */
export async function uploadAttachment(userId: number, input: { name: string; mimeType: string; dataBase64: string }) {
  const bytes = decodeBase64(input.dataBase64);
  if (!bytes) throw new AttachmentError("UNSUPPORTED", "The upload was corrupted. Please try again.");
  const v = validateAttachment({ name: input.name, declaredMime: input.mimeType, bytes });
  const db = await getDb();
  if (!db) throw new Error("Attachment storage is unavailable.");
  const id = `att_${randomUUID()}`.slice(0, 64);
  const stored = await storagePut(`home-chat/${userId}/${id}-${v.name}`, bytes, v.mimeType);
  await db.insert(homeChatAttachments).values({ id, userId, conversationId: null, name: v.name, kind: v.kind, mimeType: v.mimeType, sizeBytes: v.sizeBytes, storageKey: stored.key, sha256: createHash("sha256").update(bytes).digest("hex") });
  return { id, name: v.name, kind: v.kind, mimeType: v.mimeType, sizeBytes: v.sizeBytes };
}

/** Loads ONLY the caller's attachments; ids that don't exist or belong to someone else are simply absent. */
export async function loadAttachments(userId: number, ids: string[]): Promise<(LoadedAttachment & { sizeBytes: number })[]> {
  const db = await getDb();
  if (!db) throw new Error("Attachment storage is unavailable.");
  const rows = await db.select().from(homeChatAttachments).where(and(eq(homeChatAttachments.userId, userId), inArray(homeChatAttachments.id, ids)));
  const out: (LoadedAttachment & { sizeBytes: number })[] = [];
  for (const r of rows) {
    if (r.kind === "image" || r.kind === "pdf") out.push({ id: r.id, name: r.name, kind: r.kind, mimeType: r.mimeType, sizeBytes: r.sizeBytes, signedUrl: await storageGetSignedUrl(r.storageKey) });
    else {
      const { url } = await storageGet(r.storageKey);
      const res = await fetch(new URL(url, process.env.BUILT_IN_FORGE_API_URL ?? "http://localhost").toString());
      if (!res.ok) throw new Error("Attachment content could not be read.");
      out.push({ id: r.id, name: r.name, kind: r.kind, mimeType: r.mimeType, sizeBytes: r.sizeBytes, bytes: new Uint8Array(await res.arrayBuffer()) });
    }
  }
  return out;
}
