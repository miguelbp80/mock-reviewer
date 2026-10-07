import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Runs the Vercel functions in /api inside the Vite dev server, so local
 * development is a single `npm run dev`. Each file exports Web-standard
 * handlers named after HTTP methods (GET, POST, PATCH), as Vercel expects.
 */
const apiDevServer = (): Plugin => ({
  name: "api-dev-server",
  configureServer(server: ViteDevServer) {
    server.middlewares.use("/api", async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        const name = url.pathname.replace(/^\//, "").split("/")[0];
        if (!/^[a-z0-9-]+$/.test(name)) throw new Error("Not found");
        const mod = await server.ssrLoadModule(`/api/${name}.ts`);
        const handler = mod[req.method ?? "GET"];
        if (typeof handler !== "function") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = chunks.length ? Buffer.concat(chunks) : undefined;
        const request = new Request(new URL(`/api${req.url}`, "http://localhost"), {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
        });
        const response: Response = await handler(request);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (err) {
        res.statusCode = 404;
        res.end(err instanceof Error ? err.message : "Not found");
      }
    });
  },
});

export default defineConfig({
  plugins: [react(), apiDevServer()],
});
