# BizTech Partnerships CRM

Internal CRM for the BizTech partnerships team. One central place to manage sponsors across events, track revenue, capture meeting insights, and keep partner-facing documents organized throughout the year.

Built in-house to stay on a $0/month budget and to integrate cleanly with the tooling the team already uses (Google Workspace, Slack, Granola). The long-term product covers partner management, event/sponsorship tracking, dashboards, mass email, document storage, and MOU/invoice generation — see [Architecture.md](./Architecture.md) for the full plan and roadmap.

**V1 scope** — migrate the Partnerships CRM slice that was prototyped in `bt-web-v2`: partner directory, event sponsorship pipeline, dashboard, document/communication logs, and email ops. Meeting notes stay in scope, but they are no longer the only first product milestone.

**Current status.** The repo has the foundation in place: Next.js app, Supabase Google sign-in, Drizzle schema/migrations, RLS starter policies, and Google OAuth token storage helpers. The CRM migration inventory is captured in [docs/partnerships-crm-migration.md](./docs/partnerships-crm-migration.md).

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Hosting | Vercel (Hobby tier) |
| Database | Supabase Postgres (free tier) |
| Auth | Supabase Auth + Google OAuth (Workspace-gated) |
| ORM | Drizzle *(lands with v1 schema)* |
| UI | Tailwind v4 + shadcn/ui |
| File storage | Google Drive API *(v4)* |
| Email | Gmail API per user *(v3)* |
| Document generation | Google Docs API *(v4)* |

See Architecture.md for why each choice was made.

## Prerequisites

Before you can run the app locally you need:

- **Node.js 20+** — install from https://nodejs.org, or use `nvm` / `mise`.
- **pnpm 9+** — run `corepack enable` once and pnpm will pick up the version pinned in `package.json`. (`corepack` ships with Node.)
- **A Google account on the `@ubcbiztech.com` Workspace.** Personal Gmail accounts will be rejected at sign-in.
- **Access to the Supabase project and Google Cloud project** — ask the current owner to add you (see the team contacts section at the bottom of this file).

If you're spinning up a *brand new* Supabase + Google Cloud project (e.g., you're the first person setting this up in a new environment), follow the "First-time project setup" section below instead.

## Everyday setup (joining an existing project)

Once you have access to the Supabase project and the Google OAuth client:

```bash
git clone <this repo>
cd biztech-partnerships
pnpm install
cp .env.local.example .env.local
```

Fill in `.env.local` with values from:

- **Supabase dashboard → Project Settings → API**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Leave as-is**: `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, `ALLOWED_WORKSPACE_DOMAIN=ubcbiztech.com`

Then:

```bash
pnpm dev
```

Open http://localhost:3000. You'll be bounced to `/login`, click **Continue with Google**, pick your `@ubcbiztech.com` account, and land on a page that says "Hi, *{your name}*."

> **Workspace admin gotcha.** Security-conscious Workspaces (often the case at tech companies) restrict which OAuth apps employees can authorize. If sign-in fails with `admin_policy_enforced`, the Workspace admin needs to allow this client ID in the **Admin Console → Security → API controls → Manage Third-Party App Access**. This is one of the risks this first milestone is designed to flush out early — better to hit it on a "Hi, name" page than after you've built half the product.

### 3. Wire it up locally

```bash
cp .env.local.example .env.local
```

Fill in the values collected in steps 1–2. Then `pnpm install && pnpm dev`.

## Common commands

```bash
pnpm dev        # local dev server on :3000
pnpm build      # run tests, then production build — fails fast if tests fail
pnpm start      # run the built app
pnpm test       # run the Vitest suite once (watch mode: pnpm exec vitest)
pnpm lint       # eslint
pnpm typecheck  # tsc --noEmit, no emit
```

## Project structure

```
app/
  layout.tsx              Root layout + global styles
  page.tsx                Protected home — "Hi, {name}"
  globals.css             Tailwind v4 + shadcn design tokens
  login/
    page.tsx              Sign-in page (server component)
    actions.ts            Server action → supabase.auth.signInWithOAuth
  auth/
    callback/route.ts     Code exchange + hd-claim enforcement
    signout/route.ts      POST handler to end the session
components/               shadcn components land here as we add them
lib/
  supabase/
    client.ts             Browser client (Client Components)
    server.ts             Server client (Server Components, routes, actions)
    middleware.ts         Session refresh + route protection
  utils.ts                cn() helper for Tailwind class merging
middleware.ts             Entry point that calls updateSession
components.json           shadcn/ui config (for future `pnpm dlx shadcn add`)
Architecture.md           Long-form system design + roadmap
```

The `supabase/migrations/` directory and `lib/db/` (Drizzle schema) land with the v1 data model — they don't exist yet.

## How domain enforcement works

Three layers working together:

1. **Internal OAuth consent screen (the real gate).** The Google Cloud OAuth client is configured as **Internal**, which Google enforces on its side — only Workspace members can reach the consent step at all. This is the layer that actually keeps outsiders out.
2. **Google's account chooser (UX).** `app/login/actions.ts` passes `hd=ubcbiztech.com` when redirecting to Google, so the account picker filters to that domain. UX-only; a user can strip the query param.
3. **Server-side verification in the callback.** `app/auth/callback/route.ts` exchanges the OAuth code for a Supabase session, then enforces:
   - **Email suffix must match** `@ubcbiztech.com`. This is cryptographically verified by Google in the ID token — can't be faked.
   - **`hd` claim may match or may be absent.** Full Google Workspace accounts carry an `hd` claim and we verify it. Cloud Identity Free, multi-domain Workspaces where our domain is a secondary/alias, and some other Workspace edge cases don't emit `hd` — we accept those. A `hd` that's *present but different* is rejected, because that genuinely means the user is from a different Workspace.

   If the check fails, we call `supabase.auth.signOut()` and redirect to `/login?error=domain-email` or `/login?error=domain-hd` so you can tell them apart, and log diagnostic info to the server for follow-up.

Architecture.md mentions a Supabase Auth post-login hook as a further layer — that belongs to a v1.1 hardening pass and enforces the policy at the auth boundary rather than at the app layer. Noting it here so it doesn't get lost.

## Troubleshooting

**`Unsupported provider: provider is not enabled`.** Google OAuth isn't switched on in the Supabase project. Supabase dashboard → **Authentication → Sign In / Providers → Google** → flip the toggle on, paste the client ID/secret, save. See step 2.7 in "First-time project setup" above.

**`admin_policy_enforced` on Google sign-in.** The Workspace admin has OAuth-app restrictions on. See the "Workspace admin gotcha" callout above.

**`redirect_uri_mismatch` on Google sign-in.** The redirect URI you're hitting isn't in the OAuth client's allowlist. Check **APIs & Services → Credentials → <your client>** in Google Cloud. For local dev it must be exactly `http://localhost:3000/auth/callback` (no trailing slash).

**Signed in but bounced back to `/login?error=domain-email`.** The Google account you picked doesn't have an `@ubcbiztech.com` email. Re-try and check the account avatar in the Google picker.

**Signed in but bounced back to `/login?error=domain-hd`.** Email matched but Google's `hd` claim came through as a different Workspace primary domain. The callback logs the received values on this failure — look for `[auth/callback] domain check failed` in your `pnpm dev` terminal. If `hd` is `undefined`, the code already accepts this case (Cloud Identity Free or multi-domain edge case); make sure you're running the latest version. If `hd` is a specific other domain, UBC Biztech's Workspace has that as the primary and `ubcbiztech.com` is an alias — either set `ALLOWED_WORKSPACE_DOMAIN` to the primary, or extend the callback to accept a list of allowed domains.

**`Invalid API key` from Supabase.** The anon key in `.env.local` doesn't match the project URL. Double-check you copied both from the same Supabase project.

**"Cannot find module '@supabase/ssr'" or similar.** You haven't run `pnpm install` yet, or you ran it in the wrong directory.

**Hot reload isn't working.** Restart `pnpm dev`. Also check that you're editing files under the `app/` or `lib/` tree (not `.next/`).

## Contributing

Branch from `main`, open a PR, request a review from another partnerships-CRM contributor. Keep PRs small — the roadmap is sliced into intentionally narrow milestones so that each one is reviewable in under an hour.

When adding a shadcn component:

```bash
pnpm dlx shadcn@latest add <component>   # e.g. button, dialog, form
```

It will write into `components/ui/` and use the tokens already set in `app/globals.css` and `components.json`.

When adding a new page that should be behind auth: nothing special. The root middleware redirects any unauthenticated request (outside `/login` and `/auth/*`) to the login page automatically.

When adding a new *public* page: extend the `isPublic` check in `lib/supabase/middleware.ts`.

## Migration Pointers

- **Source CRM slice** — `bt-web-v2` commit `c16215ca0d4fb8db1845421455addc9ab5355fcf`, merged into `origin/dev` by PR #432.
- **Feature inventory** — see [docs/partnerships-crm-migration.md](./docs/partnerships-crm-migration.md).
- **Next implementation pass** — align the Drizzle schema with the confirmed CRM entities, then rebuild the old external backend surface as local App Router handlers/server actions.

## Roadmap pointers

- **V1** *(next)* — CRM data model, partners/events CRUD, partner-event pipeline, dashboard aggregations, document/communication logs, and migration-safe UI shell.
- **V2** — email templates, mail merge, Gmail send, Gmail sync ingest, and campaign/send logs.
- **V3** — Google Sheets/CSV import-export, Drive-backed documents, MOU/invoice generation.
- **V4+** — Slack reminders, scheduled follow-ups, weekly digest, and background jobs.

Full plan with rationale in [Architecture.md](./Architecture.md).

## Team contacts

Update this section with the current owner(s):
- **Supabase project admin**: John
- **Google Cloud / Workspace admin**: John
