#!/usr/bin/env node

import dotenv from "dotenv";
import pg from "pg";
import { assertValidFixtureSet, demoFixtures } from "./partnerships-dev-fixtures.mjs";

dotenv.config({ path: ".env.local" });
dotenv.config();

const { Pool } = pg;

function requireDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to seed partnerships CRM demo data.");
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
        ON CONFLICT (email) DO UPDATE SET
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
          tier_configs, description, notes, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, now())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          year = EXCLUDED.year,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          outreach_start_date = EXCLUDED.outreach_start_date,
          sponsorship_goal = EXCLUDED.sponsorship_goal,
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
        INSERT INTO company_events (company_id, event_id, event_role)
        VALUES ($1, $2, 'sponsor')
        ON CONFLICT (company_id, event_id, event_role) DO NOTHING
      `,
      [refs.companyIdsByName.get(sponsorship.companyName), refs.eventIdsByName.get(sponsorship.eventName)],
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
  assertValidFixtureSet(demoFixtures);

  const pool = new Pool({
    connectionString: requireDatabaseUrl(),
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userIdsByEmail = await upsertUsers(client, demoFixtures.users);
    const companyIdsByName = await upsertCompanies(client, demoFixtures.companies);
    const contactIdsByEmail = await upsertContacts(client, demoFixtures.contacts, companyIdsByName);
    const eventIdsByName = await upsertEvents(client, demoFixtures.events);

    const refs = {
      userIdsByEmail,
      companyIdsByName,
      contactIdsByEmail,
      eventIdsByName,
    };

    await upsertSponsorships(client, demoFixtures.sponsorships, refs);
    await upsertCompanyEventRoles(client, demoFixtures.sponsorships, refs);
    await upsertDocuments(client, demoFixtures.documents, refs);
    await upsertInteractions(client, demoFixtures.interactions, refs);
    await upsertEmailTemplates(client, demoFixtures.emailTemplates, userIdsByEmail);

    await client.query("COMMIT");

    console.log("Seeded partnerships CRM demo data:");
    console.log(`- users: ${demoFixtures.users.length}`);
    console.log(`- companies: ${demoFixtures.companies.length}`);
    console.log(`- contacts: ${demoFixtures.contacts.length}`);
    console.log(`- events: ${demoFixtures.events.length}`);
    console.log(`- sponsorships: ${demoFixtures.sponsorships.length}`);
    console.log(`- documents: ${demoFixtures.documents.length}`);
    console.log(`- interactions: ${demoFixtures.interactions.length}`);
    console.log(`- email templates: ${demoFixtures.emailTemplates.length}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
