# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Keep your replies extremely concise, and focus on conveying the key information. No unnecessary fluff, no long code snippets.

@AGENTS.md

## Next.js version notes

This project uses Next.js 16.4 and React 19.3. `next.config.ts` turns on `cacheComponents`, `partialPrefetching`, and `experimental.agentFeedback`. Root layouts use the global `LayoutProps<"/">` type helper.

## Commands

Bun is the package manager and runtime (`bun.lock`). Install dependencies with `bun install`.

- `bun dev` / `bun run build` / `bun run start`: dev server, production build, and serve. All three scripts run `next` under the Bun runtime (`--bun`), which is what makes `bun:sqlite` resolve. Keep `--bun` on any new script that loads database code.
- `bun run lint`: ESLint 9 flat config (`eslint-config-next` core-web-vitals + typescript).
- Type-check: `bunx tsc --noEmit`.

No test runner is configured yet. `SPEC.md` §14 lists the planned test areas (auth, note CRUD, editor, saving, sharing). `@types/bun` is installed, so `bun test` (or `bun test path/to/file.test.ts` for a single file) is the natural choice.

## Project state and spec

The repo is at the very start: `app/` holds only the create-next-app scaffold (a placeholder static `page.tsx`, `layout.tsx`, `globals.css`). None of the spec's features exist yet; `README.md` is the unmodified create-next-app README.

**`SPEC.md` is the source of truth for what is being built.** It specifies a note-taking app (Phase 1–7 roadmap in §15, acceptance criteria in §16), and its §18 "Final Architectural Decisions" table is authoritative. Read the relevant spec section before you implement a feature.

Path alias: `@/*` maps to the repo root. The spec's suggested folder layout (§12) uses `src/`, but the project currently keeps `app/` at the root, and the spec calls its layout a recommendation only. Keep abstractions minimal.

## Target architecture (from SPEC.md)

Stack: Next.js App Router, Bun, TypeScript, Tailwind v4 (wired through the `@tailwindcss/turbopack` loader in `next.config.ts`), Better Auth (email/password), TipTap v3, SQLite via `bun:sqlite` with **raw parameterized SQL (no ORM)**, and Zod.

Key cross-cutting rules:

- **Layers:** client components handle interaction only. Route Handlers under `app/api/notes/**` and `app/api/share/[token]` do auth, validation, and authorization. A dedicated data-access layer is the only code that touches SQLite. Use Server Components by default; the TipTap editor, toolbar, save status, share button, and login form are Client Components.
- **Auth:** Better Auth is mounted at `app/api/auth/[...all]`. Every private operation derives `userId` from `auth.api.getSession({ headers: await headers() })`; never trust a user ID sent by the client. Generate Better Auth's tables with its CLI rather than writing them by hand, and keep them separate from app tables.
- **Database:** use a single shared connection to `data/notes.sqlite` (must be gitignored, but `.gitignore` does not list `/data/` yet, so add it with the first DB code; create the directory automatically) with `PRAGMA foreign_keys = ON`, `journal_mode = WAL`, and `busy_timeout = 5000`. Better Auth owns `user`, `session`, `account` and `verification` (camelCase columns, created with `bunx auth migrate`, schema in §5.2). Application SQL never touches them directly. There is one app table, `notes` (snake_case, schema in §5.3), whose `user_id` foreign key points to `"user"(id)`, so the Better Auth migration must run first. A CHECK constraint ties `is_public` to whether `share_token` is null.
- **Content:** store the full TipTap JSON document as text, never HTML. A new note starts as `{"type":"doc","content":[{"type":"paragraph"}]}`. Validate the content server-side; invalid content returns 422.
- **Saving (the critical part):** autosave (1.5s debounce) and the manual Save button both call the same server update path. Optimistic concurrency works through `notes.revision`: the client sends the revision it believes is current, the update only applies `WHERE revision = ?`, and a mismatch returns **409**. The client keeps one save coordinator per open note: no concurrent saves, re-save if the user edited during a save, never overwrite newer local content with an older response, and keep failed changes for retry.
- **Sharing:** tokens are cryptographically random. Revoking a share nulls the token, and sharing again issues a new token. Public pages are read-only and need no auth. A note that is missing, belongs to someone else, or has a revoked token all return **404**, so the response does not reveal whether a note exists.
