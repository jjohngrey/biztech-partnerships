# BizTech Partnerships CRM — Architecture

## Overview

A centralized tool for the BizTech partnerships team to track events, partners, and past partners, and to log every contact (meetings, emails, calls) the team has with them. Built custom to stay on a $0/month budget and to integrate cleanly with the Google Workspace tooling the team already uses.

MVP scope is intentionally narrow: the five user-facing pages are **Events**, **Companies**, **Partners**, **Contact History**, and **Settings**. Pipeline tracking, sponsorship deal management, in-kind sponsor tagging, mass email/outreach, document generation, and the dashboard were removed in the June 2026 cleanup to keep the surface area focused.

## Non-functional requirements

- **Usability**: intuitive enough that any team member can use it without training. Navigation between partners, events, and contact history should take a couple of clicks at most.
- **Performance**: typical pages and filters load in under two seconds.
- **Access & security**: only `@ubcbiztech.com` Google Workspace accounts can access the app. Partner data is never publicly exposed. Multiple concurrent users are supported with no data conflicts.
- **Reliability**: regular backups, reasonable uptime, no critical data loss.
- **Scalability**: comfortably handles several hundred partners and dozens of events per year without degradation.

## Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Team preference. Server actions cover most CRUD. |
| Hosting | Vercel Hobby | Free. CI, preview deployments, edge caching included. |
| Database | Supabase Postgres | 500 MB free tier. Real SQL. Portable. |
| Auth | Supabase Auth + Google OAuth | Single provider. Workspace domain whitelist via the `hd` claim. |
| ORM | Drizzle | Typed SQL, Supabase-friendly, zero runtime overhead. |
| UI | shadcn/ui + Tailwind | Free, copy-paste components, Next.js native. |
| Contact notes | Manual entry — typed in or pasted from any source | No API dependency. The schema is tool-agnostic. |

## Data model

Supabase Postgres with row-level security. All tables enforce that the caller is an authenticated user with a `@ubcbiztech.com` email.

The June 2026 cleanup pared the app down to the tables it actually reads/writes. The DB still contains additional tables from the earlier feature set (`sponsors`, `sponsorship_contacts`, `in_kind_sponsors`, `email_templates`, `email_campaigns`, `email_sends`, `partner_documents`, `meeting_notes`, `interactions`) — they are kept in Postgres but no app code references them anymore.

### Tables used by the MVP

**users** (extends `auth.users`)
- `id` uuid, PK, FK to `auth.users.id`
- `email` text, unique, must end in `@ubcbiztech.com`
- `first_name`, `last_name` text
- `team` text, enum (`partnerships`, `experiences`, `mmd`, `internal`, `dev`)
- `role` text, enum (`admin`, `member`), default `member`
- `created_at`, `updated_at` timestamps

**companies**
- `id` uuid, PK
- `name` text, required, unique
- `website`, `linkedin`, `tier`, `notes`
- `tags` text array (the `previous-sponsor` tag flags past partners)
- `is_alumni` boolean, default `false`
- `archived` boolean, default `false`
- `created_at`, `updated_at`

**partners** (people/contacts at companies)
- `id` uuid, PK
- `company_id` uuid, FK to `companies.id`
- `first_name`, `last_name`
- `role`, `email`, `linkedin`, `phone`, `notes`
- `is_primary` boolean, default `false`
- `archived` boolean, default `false`
- `created_at`, `updated_at`

**events**
- `id` uuid, PK
- `name` text, required
- `year` integer
- `start_date`, `end_date` date
- `outreach_start_date` date, nullable
- `sponsorship_goal`, `confirmed_partner_goal` integer, nullable
- `tier_configs` jsonb
- `description`, `notes` text
- `archived` boolean, default `false`
- `created_at`, `updated_at`

**contact_activities** (the unified contact-history timeline)
- `id` uuid, PK
- `type` text, enum (`meeting`, `call`, `email`, `linkedin`, `in_person`, `note`, `other`)
- `direction` text, enum (`inbound`, `outbound`), nullable
- `subject` text, required; `content`, `summary`, `notes` text, nullable
- `occurred_at` timestamp; `follow_up_date` date, nullable
- `primary_company_id`, `primary_partner_id`, `primary_user_id` uuid, nullable FKs
- `created_by` uuid, FK to `users.id`
- `created_at`, `updated_at`

### Join tables

- **users_companies**, **users_partners**, **users_events** — associates team members with each entity.
- **partners_events** — links a partner to an event with role (booth, speaker, workshop, sponsor, judge, mentor, student) and status (asked, interested, form_sent, form_submitted, confirmed, declined, attended).
- **company_events** — same idea for companies.
- **contact_activity_companies / _partners / _events / _attendees** — many-to-many tags for activities.

### Row-level security (starter policy)

- Any authenticated `@ubcbiztech.com` user can `SELECT` on all core tables.
- `INSERT`/`UPDATE` allowed for authenticated users.
- `DELETE` allowed for the record's owner (where tracked) or admins.

## Integrations

### Google OAuth (Auth)

Used for sign-in only in the MVP. Scopes:

- `openid email profile` — baseline for Supabase Auth.

Workspace domain enforcement happens at the OAuth callback: `app/auth/callback/route.ts` verifies the email suffix matches `@ubcbiztech.com` and validates the `hd` claim if present.

A `google_oauth_tokens` table and a `lib/google/client.ts` helper exist for future Drive/Docs/Gmail integration but are not wired up to any user-facing feature today.

### Contact activity ingestion

Users enter contact activities manually from the Contact History page or from the contact-log form embedded in the Companies and Partners panels. No API or webhook integration with note-taking tools.

## Repository layout

```
biztech-partnerships/
  app/                    # Next.js App Router
    auth/                 # OAuth callback, sign-out
    companies/            # Company directory + detail
    contact-log/          # Contact activity (meetings + interactions)
    events/               # Event management
    login/                # Sign-in page
    partners/             # Partner directory + detail
    settings/             # Team / user settings
    api/                  # OAuth callback only
  components/             # shadcn/ui + app-specific
  lib/
    db/                   # Drizzle schema.ts
    google/               # OAuth client (Drive/Docs/Gmail wrappers retained for future use)
    supabase/             # Supabase client (browser + server)
    partnerships/         # Server actions, cached queries, repository
  drizzle/
    migrations/           # Schema migrations
  Architecture.md
  README.md
```

## Decision log

- **Custom build over HubSpot/Attio/Airtable** — $0 budget and full control outweigh time-to-value of a hosted CRM.
- **Supabase over Neon + Clerk / Convex** — one vendor, Postgres portability, RLS fits the "everyone in the Workspace can see everything" model cleanly.
- **June 2026 MVP cut** — removed Dashboard, Pipeline, Outreach, Meetings (legacy notes UI), Touchpoints redirect, mass email, document management, and in-kind sponsor tagging from the app. The schema for those features stays in Postgres; only the app/lib code that read or wrote them was deleted. Future work can re-introduce features incrementally by re-wiring the existing tables.
