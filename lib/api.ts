// Base URL of the Go API. NEXT_PUBLIC_ vars are inlined at build time, so a
// change requires a rebuild/redeploy.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type Health = { status: string; db: string };

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const res = await fetch(`${API_URL}/health`, { signal, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API returned ${res.status}`);
  }
  return res.json();
}
