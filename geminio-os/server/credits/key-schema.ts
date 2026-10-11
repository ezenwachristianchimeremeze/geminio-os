import { z } from "zod";
/** Client-chosen idempotency key for an AI operation: the same key + same input never executes or charges twice. */
export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, "Use 8-64 letters, digits, - or _");
