import { timingSafeEqual } from "node:crypto";

/**
 * Admin check for the home page list.
 *   POST /api/admin   { key: string }   -> { ok: true } when it matches ADMIN_KEY
 * Without ADMIN_KEY set, nobody gets in.
 */

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "x-robots-tag": "noindex" },
  });

// Best-effort brute-force guard. In-memory, so it only holds per warm instance.
const misses = new Map<string, number[]>();

const same = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export async function POST(req: Request) {
  const expected = process.env.ADMIN_KEY;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const now = Date.now();
  const recent = (misses.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 5) return json({ error: "Too many attempts, try again in a minute." }, 429);

  const input = (await req.json().catch(() => null)) as { key?: unknown } | null;
  const key = typeof input?.key === "string" ? input.key : "";
  if (!expected || !key || !same(key, expected)) {
    recent.push(now);
    misses.set(ip, recent);
    return json({ error: "Wrong key" }, 401);
  }
  return json({ ok: true });
}
