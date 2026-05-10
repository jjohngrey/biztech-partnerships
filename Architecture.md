# BizTech Partnerships CRM — Architecture

## Overview

A centralized tool for the BizTech partnerships team to manage sponsor relationships across events, track revenue, share meeting insights, and organize documents throughout the year. Built custom to stay on a $0/month budget and to integrate cleanly with the Google Workspace and Slack tooling the team already uses.

The long-term product covers partner management, event/sponsorship tracking, dashboards, mass email, document management, and MOU/invoice generation. V1 now starts from the Partnerships CRM prototype that landed in `bt-web-v2` and ports it onto this repo's Supabase/Drizzle foundation. The confirmed source feature inventory lives in [docs/partnerships-crm-migration.md](./docs/partnerships-crm-migration.md).

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
| Email sending | Gmail API per signed-in user (OAuth) | Free within Workspace limits (2,000/day per user). Sends from the user's own Gmail account. |
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
- `first_name`, `last_name` text
- `team` text, enum (`partnerships`, `experiences`, `mmd`, `internal`, `dev`)
- `role` text, enum (`admin`, `member`), default `member` — present as a forward-compatibility hook; admins have no additional privileges in v1
- `created_at`, `updated_at` timestamps

**companies** (sponsor accounts)
- `id` uuid, PK
- `name` text, required, unique
- `website`, `linkedin`, `tier`, `notes`
- `tags` text array
- `is_alumni` boolean, default `false`
- `archived` boolean, default `false`
- `created_at`, `updated_at`

**partners** (people/contacts at companies)
- `id` uuid, PK
- `company_id` uuid, FK to `companies.id`
- `first_name`, `last_name`
- `role`, `email`, `linkedin`, `phone`, `notes`
- `is_primary` boolean, default `false` — marks the primary contact for a company
- `archived` boolean, default `false`
- `created_at`, `updated_at`

**events**
- `id` uuid, PK
- `name` text, required
- `year` integer
- `start_date` date
- `end_date` date, nullable
- `outreach_start_date` date, nullable
- `sponsorship_goal` integer, nullable — stored in cents
- `confirmed_partner_goal` integer, nullable — target for confirmed sponsors
- `tier_configs` jsonb — event package presets with id, label, and default amount
- `description` text
- `notes` text
- `archived` boolean, default `false`
- `created_at`, `updated_at`

**sponsors** (cash sponsorship pipeline records)
- `id` uuid, PK
- `company_id` uuid, FK to `companies.id`
- `event_id` uuid, FK to `events.id`
- `primary_contact_id` uuid, nullable FK to `partners.id`
- `owner_user_id` uuid, nullable FK to `users.id`
- `amount` integer, nullable — stored in cents
- `tier`, `status`, `role`, `follow_up_date`, `notes`
- `archived` boolean, default `false`
- `created_at`, `updated_at`

**sponsorship_contacts**
- (`sponsor_id`, `partner_id`) composite PK
- Links additional company contacts to a sponsorship. This is what lets one sponsorship attach to both the company and multiple people without duplicating the deal.

**in_kind_sponsors** (goods/services sponsorships)
- `id` uuid, PK
- `company_id` uuid, FK to `companies.id`
- `event_id` uuid, nullable FK to `events.id`
- `primary_contact_id` uuid, nullable FK to `partners.id`
- `description` text — describes the in-kind contribution (e.g., "catering for 200 people")
- `estimated_value` integer, nullable — in cents
- `start_date`, `end_date` date — when the contribution applies
- `notes` text
- `created_at`, `updated_at`

**partner_documents**
- Link-only document metadata for v1.
- `company_id` required, with optional `partner_id`, `event_id`, and `sponsor_id`
- `title`, `type`, `status`, `url`, `file_name`, `notes`

**meeting_notes** (legacy, backfilled into contact_activities)
- `id` uuid, PK
- `title` text
- `meeting_date` timestamp
- `source` text, enum (`upload`, `paste`)
- `original_filename` text, nullable — original filename when submitted as file upload
- `content` text — full note body (plain text)
- `summary` text, nullable — short blurb for list views
- `created_by` uuid, FK to `users.id`
- `created_at`, `updated_at`

**interactions** (legacy, backfilled into contact_activities)
- `id` uuid, PK
- `user_id` uuid, FK to `users.id`
- `company_id` uuid, FK to `companies.id`
- `partner_id` uuid, nullable FK to `partners.id`
- `sponsor_id` uuid, nullable FK to `sponsors.id`
- `type` text, enum (`meeting`, `call`, `email`, `linkedin`, `in_person`, `other`)
- `direction` text, enum (`inbound`, `outbound`), nullable
- `subject` text, `notes` text
- `contacted_at` timestamp
- `follow_up_date` date, nullable
- `source` text, `external_message_id` text, `external_thread_id` text
- `created_at`, `updated_at`

**contact_activities** (canonical contact timeline — unifies interactions and meeting_notes)
- `id` uuid, PK
- `legacy_interaction_id` uuid, nullable unique FK to `interactions.id`
- `legacy_meeting_note_id` uuid, nullable unique FK to `meeting_notes.id`
- `type` text, enum (`meeting`, `call`, `email`, `linkedin`, `in_person`, `note`, `other`)
- `direction` text, enum (`inbound`, `outbound`), nullable
- `subject` text, required
- `content` text, nullable — full note/interaction body
- `summary` text, nullable
- `notes` text, nullable
- `occurred_at` timestamp
- `follow_up_date` date, nullable
- `source` text, default `manual` — how the record was created
- `source_url`, `original_filename`, `external_message_id`, `external_thread_id` text, nullable
- `primary_company_id` uuid, nullable FK to `companies.id`
- `primary_partner_id` uuid, nullable FK to `partners.id`
- `primary_user_id` uuid, nullable FK to `users.id`
- `sponsor_id` uuid, nullable FK to `sponsors.id`
- `created_by` uuid, nullable FK to `users.id`
- `created_at`, `updated_at`

### Join tables (v1)

**Relationships — who knows whom:**
- **users_companies** — (`user_id`, `company_id`). Associates a team member with a company.
- **users_partners** — (`user_id`, `partner_id`). Associates a team member with a partner.
- **users_events** — (`user_id`, `event_id`). Associates a team member with an event (e.g., event organizer).
- **partners_events** — (`partner_id`, `event_id`, `event_role`). Links a partner to an event with their role (booth, speaker, workshop, sponsor, judge, mentor, student) and status (asked, interested, form_sent, form_submitted, confirmed, declined, attended).
- **company_events** — (`company_id`, `event_id`, `event_role`). Links a company to an event with role and status.

**Contact activity tags:**
- **contact_activity_companies** — (`activity_id`, `company_id`). Tags an activity to one or more companies.
- **contact_activity_partners** — (`activity_id`, `partner_id`). Tags an activity to one or more contacts.
- **contact_activity_events** — (`activity_id`, `event_id`). Tags an activity to one or more events.
- **contact_activity_attendees** — (`activity_id`, `user_id`). Tags BizTech members as POCs or attendees.

**Legacy tags (for backfilled data):**
- **meeting_note_companies** — (`meeting_note_id`, `company_id`). Tags a note to one or more companies.
- **meeting_note_partners** — (`meeting_note_id`, `partner_id`). Tags a note to one or more contacts.
- **meeting_note_events** — (`meeting_note_id`, `event_id`). Tags a note to one or more events.
- **meeting_note_attendees** — (`meeting_note_id`, `user_id`). Tags BizTech members as POCs or attendees.

### Email ops tables

- **email_templates** — reusable subject/body templates with merge fields.
- **email_campaigns** — a send batch with rendered subject/body, sender, event, and status.
- **email_sends** — per-recipient send result, linked to company/contact when available.

### Row-level security (starter policy)

- Any authenticated `@ubcbiztech.com` user can `SELECT` on all core tables.
- `INSERT`/`UPDATE` allowed for authenticated users.
- `DELETE` allowed for the record's owner (where tracked) or admins. Join tables are admin-only.
- Policies are written once in SQL migrations and versioned with the app.

## Integrations

### Google OAuth (Auth + Drive + Docs + Gmail)

One sign-in flow, multiple scopes added incrementally as features ship:

- `openid email profile` — baseline for Supabase Auth.
- `https://www.googleapis.com/auth/drive.file` — read/write files the app creates or opens via the Drive Picker.
- `https://www.googleapis.com/auth/documents` — needed for MOU/invoice generation (v2+).
- `https://www.googleapis.com/auth/gmail.send` — mass and 1:1 email (v2+).

Tokens are stored in a `google_oauth_tokens` table keyed by `user_id`, with encrypted refresh tokens. A helper at `lib/google/client.ts` wraps token refresh so callers never touch expiry logic directly.

Workspace domain enforcement happens at the OAuth callback: `app/auth/callback/route.ts` verifies email suffix matches `@ubcbiztech.com` and validates the `hd` claim if present. A Supabase Auth post-login hook for further enforcement is planned for v1.1.

### Contact activity ingestion

Users log two types of contact activities: **interactions** (quick calls, emails, LinkedIn messages) and **notes** (longer meeting write-ups). Both feed into the canonical `contact_activities` table.

**Meeting notes:**
- No API or webhook integration with note-taking tools (Granola, Notion, Google Docs, plain text all supported).
- Users submit via file upload (`.txt`) or copy-paste; the `source` column records the method.
- File content is read client-side, previewed, and stored as `content` on save. Original filename preserved.
- The form lets users tag notes to companies, partners, events, and attendees before saving.

**Interactions:**
- Lightweight CRM activity log: type (meeting, call, email, etc.), direction (inbound/outbound), subject, and notes.
- Linked to a user, company, and optionally a partner and sponsorship deal.
- Can include external message/thread IDs for Gmail/LinkedIn/etc. sync later.

Both paths backfill into `contact_activities` via migration; the app reads/writes the unified table.

### Slack (v2+)

- Channel notifications on pipeline events (deal confirmed, MOU signed, follow-up overdue) via a single incoming webhook.
- DM reminders to the assigned POC via a Slack bot token and the `chat.postMessage` API.

Slash commands and two-way sync are explicitly out of scope.

## V1 scope — partnerships CRM migration

The v1 goal is to make the Partnerships team able to manage partner accounts, event sponsorship relationships, documents, communications, and dashboard reporting in this standalone app.

**In scope:**

- Google login restricted to `@ubcbiztech.com`.
- Company directory with search, filters, tags, alumni flag, in-kind sponsorships, archive/restore, and CSV export.
- Partner directory with company association, role, contact info, and archive/restore.
- CRM events with dates, outreach start date, sponsorship goals, confirmed-partner goals, tier presets, and archive/restore.
- Partner-event participation tracking (role, status, form submission).
- Cash sponsorship pipeline with status, package tier, role, amount, follow-up date, and notes.
- In-kind sponsorship tracking with description, estimated value, and date range.
- Dashboard metrics for cash secured, in-kind value, open pipeline, goal progress, event pace, and action items.
- Partner documents as metadata/link records (Google Drive URLs, file names, status).
- Contact activity log: manual meeting notes (file upload or paste), quick interactions (calls, emails, LinkedIn), taggable to companies, partners, events, and attendees.
- Email Ops data model and UI path for templates, merge fields, mass email, Gmail sync status, and Gmail sync setup.
- `users.role` column in place, every user defaulted to `member`; role-gated actions added only when needed.
- Team field on users for multi-team organization (partnerships, experiences, mmd, internal, dev).

**Out of scope for v1, lined up for v2+:**

- Mass email send (templates exist, Gmail send action not yet built).
- Fully automated MOU/invoice generation via Google Docs templates.
- Slack notifications and DMs.
- Weekly digest/background jobs (Vercel Cron or Supabase `pg_cron`).
- Rich Google Drive file picker/upload.
- Workspace domain enforcement post-login hook (v1.1).
- Admin-only privilege model beyond the starter `role` column.

## Roadmap

- **V1** — CRM migration foundation: schema, CRUD, partner-event pipeline, dashboard aggregations, documents, communications.
- **V2** — email ops: templates, merge fields, Gmail send, Gmail sync ingest, campaign/send logs.
- **V3** — imports/exports and documents: Google Sheets/CSV import-export, Drive-backed documents, MOU and invoice generation from Google Docs templates.
- **V4** — automation: background jobs for scheduled reminders, weekly digest, mass email chunking, Slack DMs to assigned POCs.
- **Ongoing** — admin role privileges added as specific gated actions emerge.

## Open items and risks

- **Note ingestion format**: currently accepts plain text only. If richer formatting (markdown headings, action-item lists) becomes important, a lightweight parser can be added to `lib/ingestion/` without a schema change.
- **Vercel Hobby cron limits**: daily-only on the free tier. When reminders ship in v5, either move cron into Supabase `pg_cron` (stays free) or upgrade Vercel to Pro (~$20/mo) for minute-level cron.
- **Gmail daily cap**: 2,000 sends/day per Workspace user is generous but not unlimited. A 200-recipient blast from one user consumes 10% of their daily cap. Per-user rate limiting is required once mass email ships.
- **Supabase free-tier pause**: free projects pause after 7 days of inactivity. Internal CRM usage will normally prevent this; set up a weekly cron ping if it becomes an issue.
- **File storage scale**: Drive on Workspace gives ample headroom for thousands of documents. No Supabase Storage used.

## Repository layout

```
biztech-partnerships/
  app/                    # Next.js App Router
    (auth)/
    auth/                 # OAuth callback, sign-out
    companies/            # Company directory and detail pages
    contact-log/          # Contact activity (meetings, interactions)
    dashboard/            # Metrics and action items
    events/               # Event management
    login/                # Sign-in page
    meetings/             # Meeting notes (legacy UI, feeds into contact-log)
    outreach/             # Outreach planning (future)
    partners/             # Partner directory and detail pages
    pipeline/             # Sponsorship pipeline
    api/                  # API routes (auth, integrations)
  components/             # shadcn/ui + app-specific
  lib/
    db/                   # Drizzle schema.ts
    google/               # OAuth client, Drive, Docs, Gmail wrappers
    supabase/             # Supabase client (browser + server)
  drizzle/
    migrations/           # Schema migrations (Drizzle ORM)
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
