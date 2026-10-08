export type Comment = {
  id: string;
  path: string;
  x_pct: number | null;
  y_px: number | null;
  page_width: number | null;
  /** data-anchor name of the element the pin is attached to, if any. */
  anchor: string | null;
  anchor_x_pct: number | null;
  anchor_y_pct: number | null;
  author: string;
  body: string;
  parent_id: string | null;
  status: "open" | "resolved";
  created_at: string;
};

export type Thread = Comment & { replies: Comment[]; number: number };

const request = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
};

export const listThreads = async (mockup: string, path: string): Promise<Thread[]> => {
  const params = new URLSearchParams({ mockup, path });
  const { comments } = await request<{ comments: Comment[] }>(`/api/comments?${params}`);
  const roots = comments.filter((c) => !c.parent_id);
  return roots.map((root, i) => ({
    ...root,
    number: i + 1,
    replies: comments.filter((c) => c.parent_id === root.id),
  }));
};

export const createComment = (input: {
  mockup: string;
  path: string;
  author: string;
  body: string;
  parent_id?: string;
  x_pct?: number;
  y_px?: number;
  page_width?: number;
  anchor?: string;
  anchor_x_pct?: number;
  anchor_y_pct?: number;
}) => request<{ id: string }>("/api/comments", { method: "POST", body: JSON.stringify(input) });

export const setStatus = (id: string, status: "open" | "resolved") =>
  request(`/api/comments?id=${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
