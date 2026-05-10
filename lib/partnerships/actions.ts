"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, contactActivities } from "@/lib/db";
import {
  displayNameFromAuthUser,
  resolveCrmUserForAuthUser,
} from "@/lib/auth/crm-user";
import { getAuthedClient } from "@/lib/google/client";
import { createClient } from "@/lib/supabase/server";
import {
  addCompanyEventRole,
  addPartnerEventRole,
  archivePartnerAccount,
  archiveEmailTemplate,
  createCompanyInteraction,
  updateCompanyInteraction,
  createCompany,
  createContact,
  createDirector,
  createCrmEvent,
  createEmailCampaignDraft,
  createEmailTemplate,
  createMeetingLog,
  createPartnerAccount,
  createPartnerDocument,
  createSponsorship,
  deleteCompanyInteraction,
  deleteMeetingLog,
  deletePartnerDocument,
  enqueueEmailCampaign,
  listEmailCampaigns,
  linkContactToCompany,
  logEventPartnerResponse,
  removeCompanyEventRole,
  removePartnerEventRole,
  updateCompany,
  updateCompanyEventStatus,
  updateContact,
  updateDirector,
  updateCrmEvent,
  updateEmailTemplate,
  updatePartnerEventStatus,
  updateMeetingLog,
  updateSponsorship,
} from "./repository";
import type {
  AddCompanyEventRoleInput,
  AddPartnerEventRoleInput,
  CreateCompanyInteractionInput,
  UpdateCompanyInteractionInput,
  CreateCompanyInput,
  CreateContactInput,
  CreateDirectorInput,
  CreateEmailCampaignDraftInput,
  CreateEmailTemplateInput,
  CreateEventInput,
  CreateMeetingLogInput,
  CreatePartnerDocumentInput,
  CreatePartnerInput,
  CreateSponsorshipInput,
  LogEventPartnerResponseInput,
  UpdateCompanyInput,
  UpdateContactInput,
  UpdateDirectorInput,
  UpdateEmailTemplateInput,
  UpdateEventInput,
  UpdateMeetingLogInput,
  UpdateSponsorshipInput,
} from "./types";
import { CRM_DATA_TAG } from "./cached";

function encodeRawEmail(input: { to: string; subject: string; body: string }) {
  const message = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    input.body,
  ].join("\r\n");
  return Buffer.from(message).toString("base64url");
}

const crmDataPaths = ["/", "/dashboard", "/companies", "/partners", "/events", "/meetings", "/contact-log", "/touchpoints", "/pipeline", "/outreach", "/settings"];

function revalidateCrmData(...extraPaths: string[]) {
  revalidateTag(CRM_DATA_TAG);
  for (const path of new Set([...crmDataPaths, ...extraPaths])) {
    revalidatePath(path);
  }
}

export async function createPartnerAction(input: CreatePartnerInput) {
  const partner = await createPartnerAccount(input);
  revalidateCrmData();
  return partner;
}

export async function createDirectorAction(input: CreateDirectorInput) {
  const director = await createDirector(input);
  revalidateCrmData();
  return director;
}

export async function updateDirectorAction(input: UpdateDirectorInput) {
  const director = await updateDirector(input);
  revalidateCrmData();
  return director;
}

export async function archivePartnerAction(companyId: string, archived = true) {
  const partner = await archivePartnerAccount(companyId, archived);
  revalidateCrmData();
  return partner;
}

export async function createEventAction(input: CreateEventInput) {
  const event = await createCrmEvent(input);
  revalidateCrmData();
  return event;
}

export async function updateEventAction(input: UpdateEventInput) {
  const event = await updateCrmEvent(input);
  revalidateCrmData();
  return event;
}

export async function createMeetingLogAction(input: CreateMeetingLogInput) {
  const note = await createMeetingLog(input);
  revalidateCrmData();
  return note;
}

export async function updateMeetingLogAction(input: UpdateMeetingLogInput) {
  const note = await updateMeetingLog(input);
  revalidateCrmData();
  return note;
}

export async function createPartnerDocumentAction(input: CreatePartnerDocumentInput) {
  const document = await createPartnerDocument(input);
  revalidateCrmData();
  return document;
}

export async function deletePartnerDocumentAction(documentId: string) {
  await deletePartnerDocument(documentId);
  revalidateCrmData();
}

export async function createCompanyInteractionAction(input: CreateCompanyInteractionInput) {
  const interaction = await createCompanyInteraction(input);
  revalidateCrmData();
  return {
    ...interaction,
    partnerId: interaction.primaryPartnerId,
  };
}

export async function deleteCompanyInteractionAction(interactionId: string) {
  await deleteCompanyInteraction(interactionId);
  revalidateCrmData();
}

export async function updateCompanyInteractionAction(input: UpdateCompanyInteractionInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [existing] = await db
    .select({ createdBy: contactActivities.createdBy })
    .from(contactActivities)
    .where(eq(contactActivities.id, input.id));

  if (!existing) return { error: "Contact record not found." };
  if (existing.createdBy !== user.id) return { error: "Only the creator can edit this contact record." };

  await updateCompanyInteraction(input);
  revalidateCrmData();
  return {};
}

export async function deleteMeetingLogAction(meetingLogId: string) {
  await deleteMeetingLog(meetingLogId);
  revalidateCrmData();
}

export async function createSponsorshipAction(input: CreateSponsorshipInput) {
  const sponsorship = await createSponsorship(input);
  revalidateCrmData();
  return sponsorship;
}

export async function updateSponsorshipAction(input: UpdateSponsorshipInput) {
  const sponsorship = await updateSponsorship(input);
  revalidateCrmData();
  return sponsorship;
}

export async function createCompanyAction(input: CreateCompanyInput) {
  const company = await createCompany(input);
  revalidateCrmData();
  return company;
}

export async function updateCompanyAction(input: UpdateCompanyInput) {
  const company = await updateCompany(input);
  revalidateCrmData();
  return company;
}

export async function createContactAction(input: CreateContactInput) {
  const contact = await createContact(input);
  revalidateCrmData();
  return contact;
}

export async function createContactWithEventAction(
  input: CreateContactInput & {
    eventId?: string;
    eventRole?: AddPartnerEventRoleInput["eventRole"];
    eventStatus?: AddPartnerEventRoleInput["eventStatus"];
  },
) {
  const contact = await createContact(input);
  if (input.eventId && input.eventRole) {
    await addPartnerEventRole({
      partnerId: contact.id,
      eventId: input.eventId,
      eventRole: input.eventRole,
      eventStatus: input.eventStatus,
    });
  }
  revalidateCrmData();
  return contact;
}

export async function updateContactAction(input: UpdateContactInput) {
  const contact = await updateContact(input);
  revalidateCrmData();
  return contact;
}

export async function linkContactToCompanyAction(input: { partnerId: string; companyId: string }) {
  const contact = await linkContactToCompany(input);
  revalidateCrmData();
  return contact;
}

export async function addPartnerEventRoleAction(input: AddPartnerEventRoleInput) {
  await addPartnerEventRole(input);
  revalidateCrmData();
}

export async function updatePartnerEventStatusAction(input: AddPartnerEventRoleInput & { eventStatus: NonNullable<AddPartnerEventRoleInput["eventStatus"]> }) {
  await updatePartnerEventStatus(input);
  revalidateCrmData();
}

export async function logEventPartnerResponseAction(input: LogEventPartnerResponseInput) {
  const response = await logEventPartnerResponse(input);
  revalidateCrmData();
  return response;
}

export async function removePartnerEventRoleAction(input: AddPartnerEventRoleInput) {
  await removePartnerEventRole(input);
  revalidateCrmData();
}

export async function addCompanyEventRoleAction(input: AddCompanyEventRoleInput) {
  await addCompanyEventRole(input);
  revalidateCrmData();
}

export async function updateCompanyEventStatusAction(input: AddCompanyEventRoleInput & { eventStatus: NonNullable<AddCompanyEventRoleInput["eventStatus"]> }) {
  await updateCompanyEventStatus(input);
  revalidateCrmData();
}

export async function removeCompanyEventRoleAction(input: AddCompanyEventRoleInput) {
  await removeCompanyEventRole(input);
  revalidateCrmData();
}

export async function createEmailTemplateAction(input: CreateEmailTemplateInput) {
  const template = await createEmailTemplate(input);
  revalidateCrmData();
  return template;
}

export async function updateEmailTemplateAction(input: UpdateEmailTemplateInput) {
  const template = await updateEmailTemplate(input);
  revalidateCrmData();
  return template;
}

export async function archiveEmailTemplateAction(templateId: string, archived = true) {
  const template = await archiveEmailTemplate(templateId, archived);
  revalidateCrmData();
  return template;
}

export async function createEmailCampaignDraftAction(input: CreateEmailCampaignDraftInput) {
  const campaign = await createEmailCampaignDraft(input);
  revalidateCrmData();
  return campaign;
}

/**
 * Hand a campaign off to the background worker. Does not actually call Gmail —
 * the worker drains the queue in BATCH_SIZE chunks (see lib/partnerships/email-
 * worker.ts and the route at /api/partnerships/email/send/process).
 *
 * Verifies the *signed-in user's* Gmail consent up front so the user gets the
 * "needs consent" prompt right when they hit Send instead of the campaign
 * silently failing in the worker. The actual worker uses the campaign's
 * senderUserId, which is normally the same person, but doesn't have to be.
 *
 * `scheduledAtIso` is optional; null/undefined = send as soon as the next
 * worker tick picks up the queue.
 */
export async function enqueueEmailCampaignAction(input: {
  campaignId: string;
  scheduledAtIso?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("You need to sign in before sending email.");

  const crmUser = await resolveCrmUserForAuthUser(user);

  const googleClient = await getAuthedClient(crmUser.id, [
    "https://www.googleapis.com/auth/gmail.send",
  ]);

  if ("kind" in googleClient) {
    return {
      kind: "needs-consent" as const,
      consentUrl: googleClient.consentUrl,
    };
  }

  const campaigns = await listEmailCampaigns();
  const campaign = campaigns.find((item) => item.id === input.campaignId);
  if (!campaign) throw new Error("Outreach draft was not found.");

  const queuedSends = campaign.sends.filter((send) => send.status === "queued");
  if (!queuedSends.length) {
    throw new Error("This outreach draft has no queued recipients.");
  }

  let scheduledAt: Date | null = null;
  if (input.scheduledAtIso) {
    const parsed = new Date(input.scheduledAtIso);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Scheduled send time is not a valid date.");
    }
    if (parsed.getTime() < Date.now() - 60_000) {
      // Allow ~1 minute of clock drift but reject genuinely-past schedules.
      throw new Error("Scheduled send time must be in the future.");
    }
    scheduledAt = parsed;
  }

  const queued = await enqueueEmailCampaign({
    campaignId: campaign.id,
    scheduledAt,
  });
  revalidateCrmData();

  return {
    kind: "queued" as const,
    campaignId: queued.id,
    queuedRecipientCount: queuedSends.length,
    scheduledAtIso: queued.scheduledAt?.toISOString() ?? null,
  };
}
