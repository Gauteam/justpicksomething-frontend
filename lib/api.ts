// Base URL of the Go API. NEXT_PUBLIC_ vars are inlined at build time, so a
// change requires a rebuild/redeploy.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type Member = { id: string; displayName: string; isAdmin: boolean };

export type ColumnType = "text" | "boolean" | "textarea";

export type Column = { id: string; name: string; type: ColumnType; position: number };

// Column values keyed by column ID: string for text/textarea, boolean for
// boolean. Missing means empty.
export type Fields = Record<string, string | boolean>;

export type Item = {
  id: string;
  title: string;
  createdBy: string | null;
  createdAt: string;
  fields: Fields;
  position: number;
  commentCount: number;
  up: number;
  down: number;
  score: number;
  myVote: number;
};

export type VoteMode = "thumbs" | "budget";

export type Room = {
  slug: string;
  name: string;
  updatedAt: string;
  // null = no limit
  maxItems: number | null;
  voteMode: VoteMode;
  votesPerMember: number;
  allowDuplicateVotes: boolean;
  lockedAt: string | null;
};

export type RoomData = {
  room: Room;
  me: Member;
  members: Member[];
  columns: Column[];
  items: Item[];
};

export type Comment = {
  id: string;
  itemId: string;
  authorId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
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

  if (!res.ok) {
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
  const body = (await res.json()) as RoomData | { unchanged: true };
  return "unchanged" in body ? null : body;
}

export type NewItem = { title: string; fields?: Record<string, string | boolean> };

// Adds items in order. Titles already in the room (ignoring case) are skipped,
// so the result may be shorter than `items`.
export async function addItems(slug: string, token: string, items: NewItem[]): Promise<Item[]> {
  const res = await request(`/rooms/${encodeURIComponent(slug)}/items`, {
    method: "POST",
    token,
    body: JSON.stringify({ items }),
  });
  return ((await res.json()) as { items: Item[] }).items;
}

// Sets the caller's vote: ±1 in thumbs mode, or the number of votes placed
// on the item (≥ 1) in budget mode.
export async function setVote(slug: string, token: string, itemId: string, mode: VoteMode, value: number) {
  await request(`/rooms/${encodeURIComponent(slug)}/items/${itemId}/vote`, {
    method: "PUT",
    token,
    body: JSON.stringify(mode === "budget" ? { count: value } : { value }),
  });
}

export async function clearVote(slug: string, token: string, itemId: string) {
  await request(`/rooms/${encodeURIComponent(slug)}/items/${itemId}/vote`, {
    method: "DELETE",
    token,
  });
}

const roomPath = (slug: string) => `/rooms/${encodeURIComponent(slug)}`;

// Edits an item's title and/or column values. A null value clears a column.
export async function updateItem(
  slug: string,
  token: string,
  itemId: string,
  patch: { title?: string; fields?: Record<string, string | boolean | null> },
) {
  await request(`${roomPath(slug)}/items/${itemId}`, { method: "PATCH", token, body: JSON.stringify(patch) });
}

// Sets the manual order; ids must list every item in the room.
export async function reorderItems(slug: string, token: string, ids: string[]) {
  await request(`${roomPath(slug)}/items/order`, { method: "PUT", token, body: JSON.stringify({ ids }) });
}

export async function addColumn(slug: string, token: string, name: string, type: ColumnType): Promise<Column> {
  const res = await request(`${roomPath(slug)}/columns`, {
    method: "POST",
    token,
    body: JSON.stringify({ name, type }),
  });
  return res.json();
}

export async function renameColumn(slug: string, token: string, columnId: string, name: string) {
  await request(`${roomPath(slug)}/columns/${columnId}`, { method: "PATCH", token, body: JSON.stringify({ name }) });
}

export async function deleteColumn(slug: string, token: string, columnId: string) {
  await request(`${roomPath(slug)}/columns/${columnId}`, { method: "DELETE", token });
}

// Sets the column order; ids must list every column in the room.
export async function reorderColumns(slug: string, token: string, ids: string[]) {
  await request(`${roomPath(slug)}/columns/order`, { method: "PUT", token, body: JSON.stringify({ ids }) });
}

export async function listComments(slug: string, token: string, itemId: string): Promise<Comment[]> {
  const res = await request(`${roomPath(slug)}/items/${itemId}/comments`, { token });
  return ((await res.json()) as { comments: Comment[] }).comments;
}

export async function addComment(slug: string, token: string, itemId: string, body: string): Promise<Comment> {
  const res = await request(`${roomPath(slug)}/items/${itemId}/comments`, {
    method: "POST",
    token,
    body: JSON.stringify({ body }),
  });
  return res.json();
}

export async function editComment(slug: string, token: string, commentId: string, body: string) {
  await request(`${roomPath(slug)}/comments/${commentId}`, { method: "PUT", token, body: JSON.stringify({ body }) });
}

export async function deleteComment(slug: string, token: string, commentId: string) {
  await request(`${roomPath(slug)}/comments/${commentId}`, { method: "DELETE", token });
}

export const errorMessage = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

export type SettingsPatch = Partial<
  Pick<Room, "name" | "maxItems" | "voteMode" | "votesPerMember" | "allowDuplicateVotes">
> & { locked?: boolean };

// Admin only. While locked, only { locked: false } is accepted.
export async function updateSettings(slug: string, token: string, patch: SettingsPatch) {
  await request(roomPath(slug), { method: "PATCH", token, body: JSON.stringify(patch) });
}
