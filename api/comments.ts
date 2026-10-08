import { db } from "./_db.js";

/**
 * Comments API (Vercel function, Web-standard handlers).
 *   GET    /api/comments?mockup=<id>&path=<route>   threads for one page
 *   POST   /api/comments                             new pin or reply
 *   PATCH  /api/comments?id=<id>                     { status: "open" | "resolved" }
 */

const MOCKUP_ID = /^[a-z0-9-]{3,80}$/;
const ANCHOR_ID = /^[a-z0-9-]{1,60}$/;
const LIMITS = { author: 60, body: 2000, path: 300 };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "x-robots-tag": "noindex" },
  });

// Best-effort spam guard. In-memory, so it only holds per warm instance.
const hits = new Map<string, number[]>();
const tooMany = (req: Request) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
};

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() && value.length <= max ? value.trim() : null;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mockup = url.searchParams.get("mockup") ?? "";
  const path = url.searchParams.get("path") ?? "/";
  if (!MOCKUP_ID.test(mockup)) return json({ error: "Invalid mockup" }, 400);

  const client = await db();
  const { rows } = await client.execute({
    sql: `SELECT id, path, x_pct, y_px, page_width, anchor, anchor_x_pct, anchor_y_pct,
                 author, body, parent_id, status, created_at
          FROM comments WHERE mockup = ? AND path = ? ORDER BY created_at`,
    args: [mockup, path],
  });
  return json({ comments: rows });
}

export async function POST(req: Request) {
  if (tooMany(req)) return json({ error: "Too many comments, try again in a minute." }, 429);
  const input = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!input) return json({ error: "Invalid JSON" }, 400);

  const mockup = typeof input.mockup === "string" && MOCKUP_ID.test(input.mockup) ? input.mockup : null;
  const author = text(input.author, LIMITS.author);
  const body = text(input.body, LIMITS.body);
  const path = text(input.path, LIMITS.path);
  if (!mockup || !author || !body || !path) return json({ error: "Missing or invalid fields" }, 400);

  const client = await db();
  const id = crypto.randomUUID();
  const parentId = typeof input.parent_id === "string" ? input.parent_id : null;

  if (parentId) {
    const parent = await client.execute({
      sql: "SELECT id FROM comments WHERE id = ? AND mockup = ? AND parent_id IS NULL",
      args: [parentId, mockup],
    });
    if (!parent.rows.length) return json({ error: "Thread not found" }, 404);
    await client.execute({
      sql: "INSERT INTO comments (id, mockup, path, author, body, parent_id) VALUES (?, ?, ?, ?, ?, ?)",
      args: [id, mockup, path, author, body, parentId],
    });
  } else {
    const x = Number(input.x_pct);
    const y = Number(input.y_px);
    const width = Number(input.page_width);
    if (!(x >= 0 && x <= 100) || !(y >= 0) || !(width > 0)) return json({ error: "Invalid position" }, 400);

    // Optional element anchor: the pin follows data-anchor="<anchor>" at this
    // offset (in % of the element's box). x_pct / y_px stay as the fallback.
    let anchor: string | null = null;
    let anchorX: number | null = null;
    let anchorY: number | null = null;
    if (input.anchor != null) {
      const ax = Number(input.anchor_x_pct);
      const ay = Number(input.anchor_y_pct);
      if (
        typeof input.anchor !== "string" ||
        !ANCHOR_ID.test(input.anchor) ||
        !(ax >= 0 && ax <= 100) ||
        !(ay >= 0 && ay <= 100)
      ) {
        return json({ error: "Invalid anchor" }, 400);
      }
      anchor = input.anchor;
      anchorX = ax;
      anchorY = ay;
    }

    await client.execute({
      sql: `INSERT INTO comments (id, mockup, path, x_pct, y_px, page_width, anchor, anchor_x_pct, anchor_y_pct, author, body)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, mockup, path, x, y, Math.round(width), anchor, anchorX, anchorY, author, body],
    });
  }
  return json({ id }, 201);
}

export async function PATCH(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const input = (await req.json().catch(() => null)) as { status?: unknown } | null;
  const status = input?.status;
  if (!id || (status !== "open" && status !== "resolved")) return json({ error: "Invalid request" }, 400);

  const client = await db();
  const result = await client.execute({
    sql: "UPDATE comments SET status = ? WHERE id = ? AND parent_id IS NULL",
    args: [status, id],
  });
  if (!result.rowsAffected) return json({ error: "Thread not found" }, 404);
  return json({ id, status });
}
