import type { User } from "../drizzle/schema";

type GoogleUserInput = { openId: string; email: string; name: string };
function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Google sign-in");
  return { url, key };
}
async function request(path: string, init: RequestInit = {}) {
  const { url, key } = supabaseConfig();
  const response = await fetch(url + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates", ...init.headers },
  });
  if (!response.ok) throw new Error("Supabase auth store request failed (" + response.status + ")");
  return response.status === 204 ? [] : response.json() as Promise<any[]>;
}
export async function upsertSupabaseGoogleUser(input: GoogleUserInput): Promise<void> {
  await request("geminio_auth_users?on_conflict=open_id", {
    method: "POST",
    body: JSON.stringify({ open_id: input.openId, email: input.email, name: input.name, login_method: "google", last_signed_in: new Date().toISOString() }),
  });
}
export async function getSupabaseGoogleUser(openId: string): Promise<User | undefined> {
  const rows = await request("geminio_auth_users?select=id,open_id,name,email,login_method,role,created_at,updated_at,last_signed_in&open_id=eq." + encodeURIComponent(openId) + "&limit=1");
  const row = rows[0];
  if (!row) return undefined;
  return {
    id: Number(row.id), openId: row.open_id, name: row.name, email: row.email,
    loginMethod: row.login_method, role: row.role,
    createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at),
    lastSignedIn: new Date(row.last_signed_in),
  } as User;
}
export async function upsertGoogleLastSignedIn(openId: string, date: Date) {
  await request("geminio_auth_users?open_id=eq." + encodeURIComponent(openId), {
    method: "PATCH", body: JSON.stringify({ last_signed_in: date.toISOString() }),
  });
}
