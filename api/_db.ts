import { createClient, type Client } from "@libsql/client";

// SQLite through libSQL: a local file in development, Turso (hosted SQLite)
// in production, where serverless functions have no persistent disk.
// Files starting with "_" are not exposed as Vercel routes.

let client: Client | null = null;
let ready: Promise<void> | null = null;

export const db = async (): Promise<Client> => {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    ready = client
      .batch(
        [
          `CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            mockup TEXT NOT NULL,
            path TEXT NOT NULL,
            x_pct REAL,
            y_px REAL,
            page_width INTEGER,
            author TEXT NOT NULL,
            body TEXT NOT NULL,
            parent_id TEXT REFERENCES comments(id),
            status TEXT NOT NULL DEFAULT 'open',
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          )`,
          "CREATE INDEX IF NOT EXISTS comments_page ON comments (mockup, path)",
        ],
        "write",
      )
      .then(() => undefined);
  }
  await ready;
  return client;
};
