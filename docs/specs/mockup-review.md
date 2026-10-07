# Mockup Review - spec

## Summary
A proof-of-concept web project that hosts client mockups (React + Vite views) and lets clients leave Figma-style pinned comments on them through a shareable link. Comments are persisted so the team can act on them. Built with the simplest stack available.

## Problem
Client feedback on mockups arrives scattered across email, Slack and calls, without context about which part of the mockup it refers to. The team loses time reconstructing what the client meant.

## Goals / Non-goals
Goals:
- A client can open a link and leave comments pinned to exact points of a mockup, without an account.
- Comments persist and the team can reply and resolve them.
- Validate the workflow with one real client.

Non-goals (PoC):
- User accounts, roles, permissions, login.
- Notifications (email/Slack), real-time sync between viewers.
- Design tools (drawing, versions, compare), mobile-optimized commenting.
- Integration with the Bonus website or its CRM.

## Users and stakeholders
- Bonus team (Miguel): creates mockups, shares links, replies and resolves.
- Clients: open the link, comment by name.
- Requester / approver: Miguel (assumption).

## Success metrics
- At least one real client leaves comments on a real mockup, and the team uses them to make changes.
- Zero lost comments across deploys (persistence check).

## Requirements (MVP)
R1. Mockups live as folders inside the project and each has its own unlisted URL.
  - Given a mockup folder `src/mockups/<name>`, when the project is deployed, then it is reachable at `/m/<id-with-random-suffix>` and pages send `noindex`.

R2. Comment mode with pins by coordinates.
  - Given a client on a mockup, when they turn on comment mode and click a point, then a comment box opens at that point and the pin is saved with x as % of page width and y in px from the top, plus the page path and width.
  - Given saved comments, when anyone opens the same page at a different width, then pins render at the matching relative position.

R3. Identification by name, no account.
  - Given a first-time commenter, when they post, then they are asked for a name once and it is remembered in their browser.

R4. Persistence.
  - Given comments were posted, when the page is reloaded or the app is redeployed, then all comments, replies and statuses are still there.

R5. Threaded replies.
  - Given an existing pin, when someone clicks it, then they see the thread and can add a reply.

R6. Resolve comments.
  - Given an open thread, when someone marks it resolved, then its pin is hidden by default, a "Show resolved" toggle reveals it, and it can be reopened.

R7. Multiple pages per mockup.
  - Given a mockup with several routes, when the client navigates, then only the comments for the current route are shown.

## Constraints and integrations
- Stack: React + Vite for mockups and the comment layer; Vercel functions for the API; SQLite via libSQL (local file in development, Turso in production).
- Decoupled from the Bonus website repo: separate project and deploy.
- Privacy: unlisted random URLs + noindex; no sensitive client data in mockups or comments.
- API: input validation and a best-effort rate limit on POST.
- Accessibility: pins are buttons with labels; Esc closes; forms are keyboard-usable.

## Phases
- MVP: R1-R7, desktop first. (built)
- Phase 2: Slack/email notification on new comments, edit/delete own comment, mobile commenting, element-anchored pins, password per mockup.
- Phase 3 (if useful): accounts, dashboard of projects/clients, screenshot per comment.

## Risks and mitigations
- Pins drift when the layout changes - Medium - store page width and path; consider element anchors in phase 2.
- Spam or abuse on a public endpoint - Low/Medium - unlisted URLs, input limits, rate limit.
- SQLite on serverless loses data - High if misconfigured - Turso in production; verify persistence across a redeploy before sharing.
- Client friction with comment mode - Medium - clear toolbar label and the `C` shortcut; add a first-visit hint if needed.

## Open questions
- [ ] Vercel or Netlify? (Miguel) - the code targets Vercel; Netlify would need its own function adapter.
- [ ] Turso account OK, or use the host's own database? (Miguel)
- [ ] Which real client and mockup will be the first test? (Miguel)

## Task breakdown (MVP)
1. [x] Scaffold Vite + React, mockups folder convention, routing to /m/<id>.
2. [x] SQLite (libSQL) schema: comments with position, page width, author, parent, status.
3. [x] API: list, create pin/reply, resolve/reopen, with validation.
4. [x] Comment layer: comment mode, pins, threads, resolve toggle, name prompt.
5. [x] noindex + unlisted ids.
6. [ ] Create Turso DB, deploy to Vercel, verify persistence across a redeploy.
7. [ ] Build the first real mockup and share it with a client.
