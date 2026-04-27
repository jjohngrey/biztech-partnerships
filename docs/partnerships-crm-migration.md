# Partnerships CRM Migration Notes

Source inspected: `/Users/jaypark/Documents/GitHub/bt-web-v2`, commit `c16215ca0d4fb8db1845421455addc9ab5355fcf` (`partnerships crm initial commit`), merged into `origin/dev` by PR #432 on April 27, 2026.

The old implementation is a large client-side admin pane at `src/pages/admin/partnerships.tsx` with supporting components in `src/components/PartnershipsCRM/`. It calls an external backend through `fetchBackend`; the backend route handlers are not in `bt-web-v2`.

## Confirmed Feature Inventory

### Main CRM Shell

- Admin page at `/admin/partnerships`.
- Four top-level tabs: overview, partners, events, email ops.
- Global refresh and CSV export.
- Directory filters for search, status, event, package tier, partner tier, alumni, tags, and archived records.
- Dashboard filters for year, event, follow-up window, and archived events.

### Dashboard / Overview

- Revenue secured, remaining goal, open pipeline, and action item metrics.
- Annual goal tracking with expected progress and pace status.
- Pipeline breakdown by status.
- Revenue table by event with goals, committed/secured amounts, relationship counts, and follow-up counts.
- Action item list for overdue/upcoming follow-ups and stale pipeline items.
- Google Sheets import/export affordances.
- Email sync health card with last sync, stale-sync warning, and linked inbox summary.

### Partners

- Partner directory list with quick status chips and summary stats.
- Create/edit partner modal.
- Partner fields: company, primary contact, email, phone, contact role, partner tier, LinkedIn, comma-separated tags, freeform notes, alumni flag, archived flag.
- Partner detail panel with three sub-tabs:
  - sponsorships/event involvement
  - documents
  - communications
- Archive/restore partner.

### Event Sponsorships / Pipeline

- Create/edit CRM event modal.
- Event fields: name, year, start/end date, outreach start date, sponsorship goal, notes, archived flag.
- Per-event tier presets with label and default amount.
- Link a partner to an event with status, package tier, role, amount, follow-up date, and notes.
- Custom status and custom tier support.
- Tier selection can apply the event tier's default amount.
- Delete partner-event involvement.
- Archive/restore event.

### Documents

- Add/edit/delete document links on a partner.
- Document fields: title, type, status, URL, file name, related event, notes.
- The old app stores links and metadata only; there is no Drive picker or Drive upload in this frontend slice.

### Communications

- Add/edit/delete communication log entries on a partner.
- Communication fields: subject, summary, channel, direction, occurred-at datetime, follow-up date, related event.
- Email-synced communications are visually marked and included in sync summaries.

### Email Ops / Mail Merge

- Email Ops tab loads email config and templates.
- Template CRUD:
  - create template
  - edit template
  - archive template
  - preview subject/body with sample merge values
- Merge field picker grouped by partner, sender, event, and other.
- Supported merge values in the frontend:
  - `{{company_name}}`
  - `{{contact_name}}`
  - `{{recipient_first_name}}`
  - `{{recipient_last_name}}`
  - `{{recipient_full_name}}`
  - `{{recipient_email}}`
  - `{{sender_first_name}}`
  - `{{sender_last_name}}`
  - `{{sender_full_name}}`
  - `{{sender_email}}`
  - `{{event_name}}`
  - `{{event_year}}`
- Mass email dialog:
  - select recipients from current partner list
  - search recipients
  - select all/individual recipients
  - choose related event
  - choose template or write subject/body manually
  - preview rendered email for a selected recipient
  - enforce backend-provided max recipient count
  - send and show per-recipient results
- Gmail sync setup dialog:
  - shows ingest webhook URL
  - generates Google Apps Script template
  - includes copyable setup checklist
  - includes optional JSON test payload
  - intended sync cadence is every 10-15 minutes

### External Sync / Import Export

- CSV export endpoint for partnerships data.
- Google Sheets import/export only. Postgres is the source of truth.
- Gmail sync status endpoint.
- Gmail sync ingest is referenced by the Apps Script template.

## Backend Surface To Rebuild

The old frontend expects these API endpoints:

- `GET /partnerships/dashboard`
- `GET /partnerships/partners`
- `POST /partnerships/partners`
- `GET /partnerships/partners/:partnerId`
- `PATCH /partnerships/partners/:partnerId`
- `POST /partnerships/partners/:partnerId/events`
- `POST /partnerships/partners/:partnerId/documents`
- `POST /partnerships/partners/:partnerId/communications`
- `GET /partnerships/events`
- `POST /partnerships/events`
- `GET /partnerships/events/:eventId`
- `PATCH /partnerships/events/:eventId`
- `PATCH /partnerships/partner-events/:linkId`
- `DELETE /partnerships/partner-events/:linkId`
- `PATCH /partnerships/partner-documents/:documentId`
- `DELETE /partnerships/partner-documents/:documentId`
- `PATCH /partnerships/partner-communications/:communicationId`
- `DELETE /partnerships/partner-communications/:communicationId`
- `GET /partnerships/export`
- `GET /partnerships/google-sheets/status`
- `POST /partnerships/google-sheets/sync`
- `GET /partnerships/email/config`
- `GET /partnerships/email/templates`
- `POST /partnerships/email/templates`
- `PATCH /partnerships/email/templates/:templateId`
- `GET /partnerships/email/sync/status`
- `POST /partnerships/email/sync/ingest`
- `POST /partnerships/email/send`

## Migration Implications For This Repo

This repo should not copy the old page directly. The old slice assumes:

- Pages Router, React 18, Amplify auth, and a separate `API_URL` backend.
- Dark BizTech event styling (`bt-blue-*`, `bt-green-*`) from `bt-web-v2`.
- Client-side API calls through `fetchBackend`.

This repo uses:

- Next.js 15 App Router.
- Supabase Auth and Supabase Postgres.
- Drizzle schema and migrations.
- Local server actions or App Router route handlers.
- Google OAuth token storage already started in `lib/google`.

Recommended migration order:

1. Normalize schema for CRM entities: companies, contacts, sponsorships, sponsorship-contact links, events, documents, communications, email templates, email campaigns/sends, and external sync audit rows.
2. Build server-side repository functions in `lib/partnerships/` with tests for filters, dashboard aggregation, and merge rendering.
3. Add App Router route handlers or server actions for the backend surface above.
4. Port the UI in smaller app-native sections:
   - `/partners` shell and navigation
   - overview dashboard
   - partner directory/detail CRUD
   - event/pipeline CRUD
   - document and communication logs
   - email templates and mass email
   - Gmail sync
5. Replace Apps Script webhook auth with a signed ingest secret before exposing Gmail sync ingest publicly.

## Product Decisions

- User-facing copy should say "Partners" for company/account records. Internally, `companies` are sponsor accounts and `partners` are people/contacts.
- Google Sheets is import/export only. Postgres is the source of truth.
- Mass email sends from the signed-in user's Gmail account.
- Assume no existing partner data needs migration for now.

## Remaining Open Questions

- What the production URL should be for Google OAuth redirect and Apps Script ingest.
