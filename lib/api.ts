// Base URL of the Go API. NEXT_PUBLIC_ vars are inlined at build time, so a
// change requires a rebuild/redeploy.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type Member = { id: string; displayName: string; isAdmin: boolean };

export type Item = {
  id: string;
  title: string;
  createdBy: string | null;
  createdAt: string;
  up: number;
  down: number;
  score: number;
  myVote: number;
};

export type RoomData = {
  room: { slug: string; name: string; updatedAt: string };
  me: Member;
  members: Member[];
  items: Item[];
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request(path: string, init: RequestInit & { token?: string } = {}): Promise<Response> {
  const { token, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      cache: "no-store",
      headers: {
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }

  if (!res.ok && res.status !== 304) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`);
  }
  return res;
}

export async function createRoom(name: string, displayName: string) {
  const res = await request("/rooms", {
    method: "POST",
    body: JSON.stringify({ name, displayName }),
  });
  return (await res.json()) as { slug: string; passcode: string; token: string };
}

export async function joinRoom(slug: string, passcode: string, displayName: string) {
  const res = await request(`/rooms/${encodeURIComponent(slug)}/join`, {
    method: "POST",
    body: JSON.stringify({ passcode, displayName }),
  });
  return (await res.json()) as { token: string };
}

// Returns null when nothing changed since `since` (the room's last updatedAt).
export async function getRoom(slug: string, token: string, since?: string | null): Promise<RoomData | null> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  const res = await request(`/rooms/${encodeURIComponent(slug)}${query}`, { token });
  if (res.status === 304) return null;
  return res.json();
}

export async function addItem(slug: string, token: string, title: string): Promise<Item> {
  const res = await request(`/rooms/${encodeURIComponent(slug)}/items`, {
    method: "POST",
    token,
    body: JSON.stringify({ title }),
  });
  return res.json();
}

export async function setVote(slug: string, token: string, itemId: string, value: 1 | -1) {
  await request(`/rooms/${encodeURIComponent(slug)}/items/${itemId}/vote`, {
    method: "PUT",
    token,
    body: JSON.stringify({ value }),
  });
}

export async function clearVote(slug: string, token: string, itemId: string) {
  await request(`/rooms/${encodeURIComponent(slug)}/items/${itemId}/vote`, {
    method: "DELETE",
    token,
  });
}
