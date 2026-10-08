# Mockup Review

Proof of concept: share mockups with clients through an unlisted link and collect Figma-style pinned comments on them. Spec: [docs/specs/mockup-review.md](docs/specs/mockup-review.md).

## Stack

- **Mockups + comment layer:** React + Vite (`src/`).
- **API:** Vercel functions in `api/`, Web-standard handlers (`GET`, `POST`, `PATCH`).
- **Database:** SQLite through libSQL. Locally a `local.db` file (created on first request); in production [Turso](https://turso.tech) (hosted SQLite), because serverless functions have no persistent disk.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. In development the home page lists every mockup; in production it does not (links are shared one by one).

## Add a mockup

1. Copy `src/mockups/sample-landing/` to `src/mockups/<name>/`.
2. In `index.tsx`, change `meta.id` (lowercase, digits, dashes, ending in a random suffix, e.g. `client-x-home-8fk2m1qz`) and `meta.title`.
3. Build the mockup as a normal React component. Use `wouter` `<Route>` / `<Link>` for its pages; links are relative to the mockup.
4. Scope its CSS under one root class so it never leaks into other mockups.

The mockup is served at `/m/<meta.id>`. Each page (route) keeps its own comments.

## How commenting works

- **Comment** button (or the `C` key) turns on comment mode; click anywhere to drop a pin.
- First comment asks for a name, remembered in the browser. No accounts.
- Pins store x as % of the page width and y in px from the top, plus the page width and route.
- Click a pin to read the thread, reply, or **Resolve** / **Reopen**. Resolved threads hide unless **Show resolved** is on.
- `Esc` closes the open comment, then exits comment mode.

## Deploy (Vercel)

1. Create a Turso database and token: `turso db create mockup-review` and `turso db tokens create mockup-review`.
2. Import this repo in Vercel (framework preset: Vite).
3. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (see `.env.example`).
4. Deploy, leave a comment, redeploy, and check the comment is still there before sharing with a client.

All pages send `noindex` (`index.html` meta + `X-Robots-Tag` in `vercel.json`).

## Known PoC limits

- Pins placed outside any `data-anchor` element use coordinates, so they can land off their element when the layout changes. Anchored pins follow their element; if it is hidden at a width, the pin stays at its saved position and is drawn dashed.
- Anyone with the link can comment and resolve. The API has input limits and a best-effort rate limit.
- No notifications, edit or delete yet. See the spec phases.
