#!/usr/bin/env node

import dotenv from "dotenv";
import pg from "pg";
import { assertValidFixtureSet, localFixtures } from "./partnerships-dev-fixtures.mjs";

dotenv.config({ path: ".env.local" });
dotenv.config();

const { Pool } = pg;

function requireDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to seed partnerships CRM local data.");
  }
  return databaseUrl;
}

async function upsertUsers(client, users) {
  const rows = [];
  for (const user of users) {
    const result = await client.query(
      `
        INSERT INTO users (id, email, first_name, last_name, role, team, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, now())
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          role = EXCLUDED.role,
          team = EXCLUDED.team,
          updated_at = now()
        RETURNING id, email
      `,
      [user.id, user.email, user.firstName, user.lastName, user.role, user.team],
    );
    rows.push(result.rows[0]);
  }
  return new Map(rows.map((row) => [row.email, row.id]));
}

async function upsertCompanies(client, companies) {
  const rows = [];
  for (const company of companies) {
    const result = await client.query(
      `
        INSERT INTO companies (id, name, website, linkedin, tier, tags, notes, is_alumni, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
        ON CONFLICT (name) DO UPDATE SET
          website = EXCLUDED.website,
          linkedin = EXCLUDED.linkedin,
          tier = EXCLUDED.tier,
          tags = EXCLUDED.tags,
          notes = EXCLUDED.notes,
          is_alumni = EXCLUDED.is_alumni,
          archived = false,
          updated_at = now()
        RETURNING id, name
      `,
      [
        company.id,
        company.name,
        company.website,
        company.linkedin,
        company.tier,
        company.tags,
        company.notes,
        company.isAlumni,
      ],
    );
    rows.push(result.rows[0]);
  }
  return new Map(rows.map((row) => [row.name, row.id]));
}

async function upsertContacts(client, contacts, companyIdsByName) {
  const rows = [];
  for (const contact of contacts) {
    const companyId = companyIdsByName.get(contact.companyName);
    const result = await client.query(
      `
        INSERT INTO partners (
          id, first_name, last_name, company_id, role, email, linkedin, notes, is_primary, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
        ON CONFLICT (email) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          company_id = EXCLUDED.company_id,
          role = EXCLUDED.role,
          linkedin = EXCLUDED.linkedin,
          notes = EXCLUDED.notes,
          is_primary = EXCLUDED.is_primary,
          archived = false,
          updated_at = now()
        RETURNING id, email
      `,
      [
        contact.id,
        contact.firstName,
        contact.lastName,
        companyId,
        contact.role,
        contact.email,
        contact.linkedin,
        contact.notes,
        contact.isPrimary,
      ],
    );
    rows.push(result.rows[0]);
  }
  return new Map(rows.map((row) => [row.email, row.id]));
}

async function upsertEvents(client, events) {
  const rows = [];
  for (const event of events) {
    const result = await client.query(
      `
        INSERT INTO events (
          id, name, year, start_date, end_date, outreach_start_date, sponsorship_goal,
          confirmed_partner_goal,
          tier_configs, description, notes, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, now())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          year = EXCLUDED.year,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          outreach_start_date = EXCLUDED.outreach_start_date,
          sponsorship_goal = EXCLUDED.sponsorship_goal,
          confirmed_partner_goal = EXCLUDED.confirmed_partner_goal,
          tier_configs = EXCLUDED.tier_configs,
          description = EXCLUDED.description,
          notes = EXCLUDED.notes,
          archived = false,
          updated_at = now()
        RETURNING id, name
      `,
      [
        event.id,
        event.name,
        event.year,
        event.startDate,
        event.endDate,
        event.outreachStartDate,
        event.sponsorshipGoal,
        event.confirmedPartnerGoal,
        JSON.stringify(event.tierConfigs),
        event.description,
        event.notes,
      ],
    );
    rows.push(result.rows[0]);
  }
  return new Map(rows.map((row) => [row.name, row.id]));
}

async function upsertSponsorships(client, sponsorships, refs) {
  const rows = [];
  for (const sponsorship of sponsorships) {
    const result = await client.query(
      `
        INSERT INTO sponsors (
          id, company_id, event_id, primary_contact_id, owner_user_id, amount, tier, status,
          role, follow_up_date, notes, start_date, end_date, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
        ON CONFLICT (id) DO UPDATE SET
          company_id = EXCLUDED.company_id,
          event_id = EXCLUDED.event_id,
          primary_contact_id = EXCLUDED.primary_contact_id,
          owner_user_id = EXCLUDED.owner_user_id,
          amount = EXCLUDED.amount,
          tier = EXCLUDED.tier,
          status = EXCLUDED.status,
          role = EXCLUDED.role,
          follow_up_date = EXCLUDED.follow_up_date,
          notes = EXCLUDED.notes,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          archived = false,
          updated_at = now()
        RETURNING id
      `,
      [
        sponsorship.id,
        refs.companyIdsByName.get(sponsorship.companyName),
        refs.eventIdsByName.get(sponsorship.eventName),
        refs.contactIdsByEmail.get(sponsorship.primaryContactEmail),
        refs.userIdsByEmail.get(sponsorship.ownerEmail),
        sponsorship.amount,
        sponsorship.tier,
        sponsorship.status,
        sponsorship.role,
        sponsorship.followUpDate,
        sponsorship.notes,
        sponsorship.startDate,
        sponsorship.endDate,
      ],
    );
    rows.push(result.rows[0]);

    await client.query(
      `
        INSERT INTO sponsorship_contacts (sponsor_id, partner_id, is_primary, notes)
        VALUES ($1, $2, true, 'Seeded primary sponsor contact')
        ON CONFLICT (sponsor_id, partner_id) DO UPDATE SET
          is_primary = EXCLUDED.is_primary,
          notes = EXCLUDED.notes
      `,
      [sponsorship.id, refs.contactIdsByEmail.get(sponsorship.primaryContactEmail)],
    );
  }
  return new Map(rows.map((row) => [row.id, row.id]));
}

async function upsertCompanyEventRoles(client, sponsorships, refs) {
  for (const sponsorship of sponsorships) {
    await client.query(
      `
        INSERT INTO company_events (company_id, event_id, event_role, event_status)
        VALUES ($1, $2, 'sponsor', $3)
        ON CONFLICT (company_id, event_id, event_role) DO UPDATE SET
          event_status = EXCLUDED.event_status
      `,
      [
        refs.companyIdsByName.get(sponsorship.companyName),
        refs.eventIdsByName.get(sponsorship.eventName),
        sponsorship.status === "confirmed" || sponsorship.status === "paid" ? "confirmed" : "asked",
      ],
    );
  }
}

async function upsertPartnerEventRoles(client, partnerEventRoles, refs) {
  for (const role of partnerEventRoles) {
    await client.query(
      `
        INSERT INTO partners_events (partner_id, event_id, event_role, event_status)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (partner_id, event_id, event_role) DO UPDATE SET
          event_status = EXCLUDED.event_status
      `,
      [
        refs.contactIdsByEmail.get(role.partnerEmail),
        refs.eventIdsByName.get(role.eventName),
        role.eventRole,
        role.eventStatus ?? "asked",
      ],
    );
  }
}

async function upsertDocuments(client, documents, refs) {
  for (const document of documents) {
    await client.query(
      `
        INSERT INTO partner_documents (
          id, company_id, partner_id, event_id, sponsor_id, title, type, status,
          url, file_name, notes, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
        ON CONFLICT (id) DO UPDATE SET
          company_id = EXCLUDED.company_id,
          partner_id = EXCLUDED.partner_id,
          event_id = EXCLUDED.event_id,
          sponsor_id = EXCLUDED.sponsor_id,
          title = EXCLUDED.title,
          type = EXCLUDED.type,
          status = EXCLUDED.status,
          url = EXCLUDED.url,
          file_name = EXCLUDED.file_name,
          notes = EXCLUDED.notes,
          updated_at = now()
      `,
      [
        document.id,
        refs.companyIdsByName.get(document.companyName),
        refs.contactIdsByEmail.get(document.partnerEmail),
        refs.eventIdsByName.get(document.eventName),
        document.sponsorshipId,
        document.title,
        document.type,
        document.status,
        document.url,
        document.fileName,
        document.notes,
      ],
    );
  }
}

async function upsertInteractions(client, interactions, refs) {
  for (const interaction of interactions) {
    await client.query(
      `
        INSERT INTO interactions (
          id, user_id, company_id, partner_id, sponsor_id, type, direction, subject,
          notes, contacted_at, follow_up_date, source, external_message_id, external_thread_id, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          company_id = EXCLUDED.company_id,
          partner_id = EXCLUDED.partner_id,
          sponsor_id = EXCLUDED.sponsor_id,
          type = EXCLUDED.type,
          direction = EXCLUDED.direction,
          subject = EXCLUDED.subject,
          notes = EXCLUDED.notes,
          contacted_at = EXCLUDED.contacted_at,
          follow_up_date = EXCLUDED.follow_up_date,
          source = EXCLUDED.source,
          external_message_id = EXCLUDED.external_message_id,
          external_thread_id = EXCLUDED.external_thread_id,
          updated_at = now()
      `,
      [
        interaction.id,
        refs.userIdsByEmail.get(interaction.userEmail),
        refs.companyIdsByName.get(interaction.companyName),
        refs.contactIdsByEmail.get(interaction.partnerEmail),
        interaction.sponsorshipId,
        interaction.type,
        interaction.direction,
        interaction.subject,
        interaction.notes,
        interaction.contactedAt,
        interaction.followUpDate,
        interaction.source,
        interaction.externalMessageId,
        interaction.externalThreadId,
      ],
    );
  }
}

async function upsertMeetingLogs(client, meetings, refs) {
  for (const meeting of meetings) {
    await client.query(
      `
        INSERT INTO meeting_notes (
          id, title, meeting_date, source, content, summary, created_by, updated_at
        )
        VALUES ($1, $2, $3, 'manual', $4, $5, $6, now())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          meeting_date = EXCLUDED.meeting_date,
          source = EXCLUDED.source,
          content = EXCLUDED.content,
          summary = EXCLUDED.summary,
          created_by = EXCLUDED.created_by,
          updated_at = now()
      `,
      [
        meeting.id,
        meeting.title,
        meeting.meetingDate,
        meeting.content,
        meeting.summary,
        refs.userIdsByEmail.get(meeting.attendeeEmails[0]),
      ],
    );

    await client.query("DELETE FROM meeting_note_companies WHERE meeting_note_id = $1", [meeting.id]);
    await client.query("DELETE FROM meeting_note_partners WHERE meeting_note_id = $1", [meeting.id]);
    await client.query("DELETE FROM meeting_note_events WHERE meeting_note_id = $1", [meeting.id]);
    await client.query("DELETE FROM meeting_note_attendees WHERE meeting_note_id = $1", [meeting.id]);

    await client.query(
      `
        INSERT INTO meeting_note_companies (meeting_note_id, company_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [meeting.id, refs.companyIdsByName.get(meeting.companyName)],
    );
    await client.query(
      `
        INSERT INTO meeting_note_events (meeting_note_id, event_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [meeting.id, refs.eventIdsByName.get(meeting.eventName)],
    );

    for (const email of meeting.partnerEmails) {
      await client.query(
        `
          INSERT INTO meeting_note_partners (meeting_note_id, partner_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `,
        [meeting.id, refs.contactIdsByEmail.get(email)],
      );
    }

    for (const email of meeting.attendeeEmails) {
      await client.query(
        `
          INSERT INTO meeting_note_attendees (meeting_note_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `,
        [meeting.id, refs.userIdsByEmail.get(email)],
      );
    }
  }
}

async function backfillContactActivities(client) {
  await client.query(`
    INSERT INTO contact_activities (
      legacy_interaction_id, type, direction, subject, notes, occurred_at,
      follow_up_date, source, external_message_id, external_thread_id,
      primary_company_id, primary_partner_id, primary_user_id, sponsor_id,
      created_by, created_at, updated_at
    )
    SELECT
      i.id,
      i.type,
      i.direction,
      COALESCE(NULLIF(BTRIM(i.subject), ''), INITCAP(REPLACE(i.type, '_', ' '))),
      i.notes,
      i.contacted_at,
      i.follow_up_date,
      COALESCE(NULLIF(BTRIM(i.source), ''), 'manual'),
      i.external_message_id,
      i.external_thread_id,
      i.company_id,
      i.partner_id,
      i.user_id,
      i.sponsor_id,
      i.user_id,
      i.created_at,
      i.updated_at
    FROM interactions i
    ON CONFLICT (legacy_interaction_id) DO UPDATE SET
      type = EXCLUDED.type,
      direction = EXCLUDED.direction,
      subject = EXCLUDED.subject,
      notes = EXCLUDED.notes,
      occurred_at = EXCLUDED.occurred_at,
      follow_up_date = EXCLUDED.follow_up_date,
      source = EXCLUDED.source,
      external_message_id = EXCLUDED.external_message_id,
      external_thread_id = EXCLUDED.external_thread_id,
      primary_company_id = EXCLUDED.primary_company_id,
      primary_partner_id = EXCLUDED.primary_partner_id,
      primary_user_id = EXCLUDED.primary_user_id,
      sponsor_id = EXCLUDED.sponsor_id,
      created_by = EXCLUDED.created_by,
      updated_at = EXCLUDED.updated_at
  `);

  await client.query(`
    INSERT INTO contact_activities (
      legacy_meeting_note_id, type, subject, content, summary, occurred_at,
      source, source_url, original_filename, primary_company_id,
      primary_partner_id, primary_user_id, created_by, created_at, updated_at
    )
    SELECT
      mn.id,
      'meeting',
      mn.title,
      mn.content,
      mn.summary,
      mn.meeting_date,
      mn.source,
      mn.source_url,
      mn.original_filename,
      (SELECT mnc.company_id FROM meeting_note_companies mnc WHERE mnc.meeting_note_id = mn.id LIMIT 1),
      (SELECT mnp.partner_id FROM meeting_note_partners mnp WHERE mnp.meeting_note_id = mn.id LIMIT 1),
      COALESCE(mn.created_by, (SELECT mna.user_id FROM meeting_note_attendees mna WHERE mna.meeting_note_id = mn.id LIMIT 1)),
      mn.created_by,
      mn.created_at,
      mn.updated_at
    FROM meeting_notes mn
    ON CONFLICT (legacy_meeting_note_id) DO UPDATE SET
      subject = EXCLUDED.subject,
      content = EXCLUDED.content,
      summary = EXCLUDED.summary,
      occurred_at = EXCLUDED.occurred_at,
      source = EXCLUDED.source,
      source_url = EXCLUDED.source_url,
      original_filename = EXCLUDED.original_filename,
      primary_company_id = EXCLUDED.primary_company_id,
      primary_partner_id = EXCLUDED.primary_partner_id,
      primary_user_id = EXCLUDED.primary_user_id,
      created_by = EXCLUDED.created_by,
      updated_at = EXCLUDED.updated_at
  `);

  await client.query(`
    INSERT INTO contact_activity_companies (activity_id, company_id)
    SELECT ca.id, i.company_id
    FROM contact_activities ca
    JOIN interactions i ON i.id = ca.legacy_interaction_id
    WHERE i.company_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
  await client.query(`
    INSERT INTO contact_activity_companies (activity_id, company_id)
    SELECT ca.id, mnc.company_id
    FROM contact_activities ca
    JOIN meeting_note_companies mnc ON mnc.meeting_note_id = ca.legacy_meeting_note_id
    ON CONFLICT DO NOTHING
  `);
  await client.query(`
    INSERT INTO contact_activity_partners (activity_id, partner_id)
    SELECT ca.id, i.partner_id
    FROM contact_activities ca
    JOIN interactions i ON i.id = ca.legacy_interaction_id
    WHERE i.partner_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
  await client.query(`
    INSERT INTO contact_activity_partners (activity_id, partner_id)
    SELECT ca.id, mnp.partner_id
    FROM contact_activities ca
    JOIN meeting_note_partners mnp ON mnp.meeting_note_id = ca.legacy_meeting_note_id
    ON CONFLICT DO NOTHING
  `);
  await client.query(`
    INSERT INTO contact_activity_events (activity_id, event_id)
    SELECT ca.id, s.event_id
    FROM contact_activities ca
    JOIN interactions i ON i.id = ca.legacy_interaction_id
    JOIN sponsors s ON s.id = i.sponsor_id
    WHERE s.event_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
  await client.query(`
    INSERT INTO contact_activity_events (activity_id, event_id)
    SELECT ca.id, mne.event_id
    FROM contact_activities ca
    JOIN meeting_note_events mne ON mne.meeting_note_id = ca.legacy_meeting_note_id
    ON CONFLICT DO NOTHING
  `);
  await client.query(`
    INSERT INTO contact_activity_attendees (activity_id, user_id)
    SELECT ca.id, i.user_id
    FROM contact_activities ca
    JOIN interactions i ON i.id = ca.legacy_interaction_id
    WHERE i.user_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
  await client.query(`
    INSERT INTO contact_activity_attendees (activity_id, user_id)
    SELECT ca.id, mna.user_id
    FROM contact_activities ca
    JOIN meeting_note_attendees mna ON mna.meeting_note_id = ca.legacy_meeting_note_id
    ON CONFLICT DO NOTHING
  `);
}

async function upsertEmailTemplates(client, templates, userIdsByEmail) {
  for (const template of templates) {
    await client.query(
      `
        INSERT INTO email_templates (
          id, name, description, subject_template, body_template, created_by, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, now())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          subject_template = EXCLUDED.subject_template,
          body_template = EXCLUDED.body_template,
          created_by = EXCLUDED.created_by,
          archived = false,
          updated_at = now()
      `,
      [
        template.id,
        template.name,
        template.description,
        template.subjectTemplate,
        template.bodyTemplate,
        userIdsByEmail.get(template.createdByEmail),
      ],
    );
  }
}

async function seed() {
  assertValidFixtureSet(localFixtures);

  const pool = new Pool({
    connectionString: requireDatabaseUrl(),
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userIdsByEmail = await upsertUsers(client, localFixtures.users);
    const companyIdsByName = await upsertCompanies(client, localFixtures.companies);
    const contactIdsByEmail = await upsertContacts(client, localFixtures.contacts, companyIdsByName);
    const eventIdsByName = await upsertEvents(client, localFixtures.events);

    const refs = {
      userIdsByEmail,
      companyIdsByName,
      contactIdsByEmail,
      eventIdsByName,
    };

    await upsertSponsorships(client, localFixtures.sponsorships, refs);
    await upsertCompanyEventRoles(client, localFixtures.sponsorships, refs);
    await upsertPartnerEventRoles(client, localFixtures.partnerEventRoles, refs);
    await upsertDocuments(client, localFixtures.documents, refs);
    await upsertInteractions(client, localFixtures.interactions, refs);
    await upsertMeetingLogs(client, localFixtures.meetings, refs);
    await backfillContactActivities(client);
    await upsertEmailTemplates(client, localFixtures.emailTemplates, userIdsByEmail);

    await client.query("COMMIT");

    console.log("Seeded partnerships CRM local data:");
    console.log(`- users: ${localFixtures.users.length}`);
    console.log(`- companies: ${localFixtures.companies.length}`);
    console.log(`- contacts: ${localFixtures.contacts.length}`);
    console.log(`- events: ${localFixtures.events.length}`);
    console.log(`- sponsorships: ${localFixtures.sponsorships.length}`);
    console.log(`- partner event roles: ${localFixtures.partnerEventRoles.length}`);
    console.log(`- documents: ${localFixtures.documents.length}`);
    console.log(`- interactions: ${localFixtures.interactions.length}`);
    console.log(`- meetings: ${localFixtures.meetings.length}`);
    console.log(`- email templates: ${localFixtures.emailTemplates.length}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// seed().catch((error) => {
//   console.error(error);
//   process.exitCode = 1;
// });
