# BizTech Partnerships CRM — Architecture

## Overview

A centralized tool for the BizTech partnerships team to manage sponsor relationships across events, track revenue, share meeting insights, and organize documents throughout the year. Built custom to stay on a $0/month budget and to integrate cleanly with the Google Workspace and Slack tooling the team already uses.

The long-term product covers partner management, event/sponsorship tracking, dashboards, mass email, document management, and MOU/invoice generation. V1 is deliberately narrower: a shared meeting-notes hub on top of a lightweight partners/events/users foundation.

## Non-functional requirements

- **Usability**: intuitive enough that any team member can use it without training. Navigation between partners, events, and meeting notes should take a couple of clicks at most.
- **Performance**: typical pages and filters load in under two seconds. Mass email (when built) must handle 200+ recipients without timeout.
- **Access & security**: only `@ubcbiztech.com` Google Workspace accounts can access the app. Partner and financial data is never publicly exposed. Multiple concurrent users are supported with no data conflicts.
- **Reliability**: regular backups, reasonable uptime, no critical data loss.
- **Scalability**: comfortably handles several hundred partners, dozens of events per year, and a few thousand documents without degradation.

## Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Team preference. Server actions cover most CRUD. |
| Hosting | Vercel Hobby | Free. CI, preview deployments, edge caching included. |
| Database | Supabase Postgres | 500 MB free tier. Real SQL. Portable. |
| Auth | Supabase Auth + Google OAuth | Single provider. Workspace domain whitelist via the `hd` claim. |
| ORM | Drizzle | Typed SQL, Supabase-friendly, zero runtime overhead. |
| UI | shadcn/ui + Tailwind | Free, copy-paste components, Next.js native. |
| File storage | Google Drive API | Files live in the shared BizTech Drive; DB stores Drive IDs + metadata. |
| Email sending | Gmail API per user (OAuth) | Free within Workspace limits (2,000/day per user). Personal From address. |
| Document generation | Google Docs API | Copy template, `batchUpdate` to replace `{{placeholders}}`, export PDF, save Drive ID. |
| Slack | Incoming webhook + bot token | Channel updates and DM reminders to the assigned POC. |
| Meeting notes | Manual ingestion — TXT file upload or copy-paste | No API dependency. Users export or copy notes from any tool and submit them directly. |
| Background jobs | Deferred | Start synchronous. Introduce Vercel Cron + chunked sends or Supabase `pg_cron` when mass email or scheduled reminders ship. |

The elegance of this stack is that Google Workspace covers five concerns through a single OAuth flow with incremental scopes: identity (Auth), file storage (Drive), document templating (Docs), email sending (Gmail), and — if useful later — calendar linking.

## Data model

Supabase Postgres with row-level security. All tables enforce that the caller is an authenticated user with a `@ubcbiztech.com` email.

### Core tables (v1)

**users** (extends `auth.users`)
- `id` uuid, PK, FK to `auth.users.id`
- `email` text, unique, must end in `@ubcbiztech.com`
- `name` text
- `role` text, enum (`admin`, `member`), default `member` — present as a forward-compatibility hook; admins have no additional privileges in v1
- `created_at`, `updated_at` timestamps

**partners** (companies)
- `id` uuid, PK
- `name` text, required
- `primary_contact_name` text, nullable in v1
- `primary_contact_email` text, nullable in v1
- `phone` text, nullable
- `tier` text, nullable
- `notes` text
- `archived` boolean, default `false`
- `created_at`, `updated_at`

**events**
- `id` uuid, PK
- `name` text, required
- `start_date` date
- `end_date` date, nullable
- `description` text
- `archived` boolean, default `false`
- `created_at`, `updated_at`

**meeting_notes**
- `id` uuid, PK
- `title` text
- `meeting_date` timestamp
- `source` text, enum (`upload`, `paste`) — distinguishes TXT file uploads from direct copy-paste submissions
- `original_filename` text, nullable — original filename when the note was submitted as a TXT upload
- `content` text — full note body (markdown)
- `summary` text, nullable — short blurb for list views
- `created_by` uuid, FK to `users.id`
- `created_at`, `updated_at`

### Join tables (v1)

- **meeting_note_partners** — (`meeting_note_id`, `partner_id`). Tags a note to one or more companies.
- **meeting_note_events** — (`meeting_note_id`, `event_id`). Tags a note to one or more events.
- **meeting_note_attendees** — (`meeting_note_id`, `user_id`). Tags BizTech members/executives as POCs or attendees for that conversation.

### Deferred tables (v2+)

- **sponsorships** — (`partner_id`, `event_id`, `amount`, `package_tier`, `status`). Captures pipeline state.
- **documents** — metadata wrapper around Drive files, linked to partner and/or event, typed (MOU, deck, invoice, package), status (draft, sent, signed).
- **email_sends** — per-partner log of emails sent through the Gmail integration.
- **email_templates** — reusable bodies with merge fields.
- **follow_ups** — scheduled reminders surfaced on the dashboard.

### Row-level security (starter policy)

- Any authenticated `@ubcbiztech.com` user can `SELECT` on all core tables.
- `INSERT`/`UPDATE` allowed for authenticated users.
- `DELETE` allowed only for the record's creator (or admin, once admin privileges are defined).
- Policies are written once in SQL migrations and versioned with the app.

## Integrations

### Google OAuth (Auth + Drive + Docs + Gmail)

One sign-in flow, multiple scopes added incrementally as features ship:

- `openid email profile` — baseline for Supabase Auth.
- `https://www.googleapis.com/auth/drive.file` — read/write files the app creates or opens via the Drive Picker.
- `https://www.googleapis.com/auth/documents` — needed for MOU/invoice generation (v2+).
- `https://www.googleapis.com/auth/gmail.send` — mass and 1:1 email (v2+).

Tokens are stored in a `google_oauth_tokens` table keyed by `user_id`, with encrypted refresh tokens. A helper at `lib/google/client.ts` wraps token refresh so callers never touch expiry logic directly.

Workspace domain enforcement uses the `hd` claim: the Supabase Auth post-login hook rejects any account where `hd !== 'ubcbiztech.com'`.

### Meeting note ingestion

There is no API or webhook integration with any note-taking tool. Users bring their own notes — written in Granola, Notion, Google Docs, or plain text — and submit them through one of two paths:

- **TXT upload** — user exports or saves their notes as a `.txt` file and uploads it via the "New meeting note" form. The file content is read client-side, displayed in a preview, and stored as `content` on save. The original filename is stored in `original_filename`.
- **Copy-paste** — user copies their note body directly into the text area on the form.

Either path lands in the same `meeting_notes` table row; the `source` column records which method was used. The form then lets the user tag the note to partners, events, and attendees before saving.

### Slack (v2+)

- Channel notifications on pipeline events (deal confirmed, MOU signed, follow-up overdue) via a single incoming webhook.
- DM reminders to the assigned POC via a Slack bot token and the `chat.postMessage` API.

Slash commands and two-way sync are explicitly out of scope.

## V1 scope — meeting notes hub

The v1 goal is to make BizTech meetings visible to the whole team and attach them to the right company, event, and people.

**In scope:**

- Google login restricted to `@ubcbiztech.com`.
- Minimal CRUD for partners (companies): name, notes, archive.
- Minimal CRUD for events: name, dates, description.
- Meeting notes list view with filters by partner, event, attendee, and date range.
- Meeting note detail view showing content, linked company/event/attendee chips, and source method (upload vs. paste).
- Create/edit meeting note form with tag pickers for partner, event, and attendee.
- TXT file upload ingestion path — file content read client-side, previewed, then saved.
- Copy-paste ingestion path — plain text area on the same form.
- `users.role` column in place, every user defaulted to `member`; no role-gated actions yet.

**Out of scope for v1, lined up for v2+:**

- Sponsorship pipeline and dollar tracking.
- Dashboard and reporting.
- Mass email and templates.
- Document management and MOU/invoice generation.
- Slack notifications and DMs.
- Follow-up reminders and weekly digest.
- Admin-only privileges (delete, user management, template ownership, POC reassignment, financial visibility gating).

## Roadmap

- **V1** — meeting notes hub (this doc's focus).
- **V2** — sponsorship pipeline: add `sponsorships` table, per-partner detail view with sponsorship history, pipeline kanban, basic revenue dashboard.
- **V3** — communication: Gmail OAuth scope, 1:1 send from the partner detail view, per-partner email log, Slack channel webhook on pipeline state changes.
- **V4** — documents: Drive-backed `documents` table, document hub with type/status filters, MOU and invoice generation from Google Docs templates.
- **V5** — automation: background jobs for scheduled reminders, weekly digest, mass email chunking, Slack DMs to assigned POCs.
- **Ongoing** — admin role privileges added as specific gated actions emerge.

## Open items and risks

- **Note ingestion format**: currently accepts plain text only. If richer formatting (markdown headings, action-item lists) becomes important, a lightweight parser can be added to `lib/ingestion/` without a schema change.
- **Vercel Hobby cron limits**: daily-only on the free tier. When reminders ship in v5, either move cron into Supabase `pg_cron` (stays free) or upgrade Vercel to Pro (~$20/mo) for minute-level cron.
- **Gmail daily cap**: 2,000 sends/day per Workspace user is generous but not unlimited. A 200-recipient blast from one user consumes 10% of their daily cap. Per-user rate limiting is required once mass email ships.
- **Supabase free-tier pause**: free projects pause after 7 days of inactivity. Internal CRM usage will normally prevent this; set up a weekly cron ping if it becomes an issue.
- **File storage scale**: Drive on Workspace gives ample headroom for thousands of documents. No Supabase Storage used.

## Repository layout (proposed)

```
biztech-crm/
  app/                    # Next.js App Router
    (auth)/
    partners/
    events/
    meetings/
    api/
  components/             # shadcn/ui + app-specific
  lib/
    db/                   # Drizzle schema + migrations
    google/               # OAuth client, Drive, Docs, Gmail wrappers
    ingestion/            # TXT upload parser + paste normalization
    slack/                # webhook + bot wrappers (v2+)
  supabase/
    migrations/
    policies/             # RLS definitions
  Architecture.md
  README.md
```

## Decision log

- **Custom build over HubSpot/Attio/Airtable** — $0 budget and full control outweigh time-to-value of a hosted CRM.
- **Supabase over Neon + Clerk / Convex** — one vendor, Postgres portability, RLS fits the "everyone in the Workspace can see everything" model cleanly.
- **Google Drive over Supabase Storage or R2** — team already uses Drive, native previews and sharing, 15 GB+ free per Workspace seat.
- **Gmail API over transactional services** — matches the "integrate with Gmail" requirement, free at BizTech's scale, replies land in the sender's real inbox.
- **Defer admin privileges** — `role` column present, behavior identical to `member` for now. Gate specific actions when a real need appears.
- **Defer background jobs** — synchronous sends work up to ~20 recipients. Swap in Vercel Cron or `pg_cron` when v5 lands.
- **No Granola API integration** — no access to the startup program or a public API. Manual ingestion (TXT upload or paste) covers the workflow without any third-party dependency, and the schema stays tool-agnostic if the team changes note-taking apps.
