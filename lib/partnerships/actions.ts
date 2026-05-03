"use server";

import { revalidatePath, revalidateTag } from "next/cache";
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
  buildMergeValues,
  createCompanyInteraction,
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
  deletePartnerDocument,
  listEmailCampaigns,
  listEmailRecipients,
  listEvents,
  listUsers,
  linkContactToCompany,
  logEventPartnerResponse,
  logEmailInteraction,
  removeCompanyEventRole,
  removePartnerEventRole,
  renderMergeTemplate,
  updateEmailCampaignStatus,
  updateEmailSendResult,
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
  CrmUserSummary,
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
  return interaction;
}

export async function deleteCompanyInteractionAction(interactionId: string) {
  await deleteCompanyInteraction(interactionId);
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

export async function sendEmailCampaignAction(campaignId: string) {
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

  const [campaigns, recipients, events, users] = await Promise.all([
    listEmailCampaigns(),
    listEmailRecipients(),
    listEvents(),
    listUsers(),
  ]);

  const campaign = campaigns.find((item) => item.id === campaignId);
  if (!campaign) throw new Error("Outreach draft was not found.");

  const sends = campaign.sends.filter((send) => send.status === "queued");
  if (!sends.length) throw new Error("This outreach draft has no queued recipients.");

  await updateEmailCampaignStatus(campaign.id, "sending");

  const recipientByPartnerId = new Map(recipients.map((recipient) => [recipient.id, recipient]));
  const event = campaign.eventId ? events.find((item) => item.id === campaign.eventId) ?? null : null;
  const fallbackSenderName = displayNameFromAuthUser(user);
  const campaignSender =
    (campaign.senderUserId ? users.find((item) => item.id === campaign.senderUserId) : null) ??
    ({
      id: crmUser.id,
      firstName: fallbackSenderName.split(" ")[0] ?? fallbackSenderName,
      lastName: fallbackSenderName.split(" ").slice(1).join(" "),
      name: fallbackSenderName,
      email: crmUser.email,
      role: crmUser.role,
      team: crmUser.team,
    } satisfies CrmUserSummary);

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const results: Array<{ email: string; status: "sent" | "failed" | "skipped"; message: string }> = [];

  for (const send of sends) {
    const recipient = send.partnerId ? recipientByPartnerId.get(send.partnerId) : null;
    if (!recipient) {
      skippedCount += 1;
      await updateEmailSendResult({
        sendId: send.id,
        status: "skipped",
        error: "Recipient no longer has an email-ready partner record.",
      });
      results.push({
        email: send.recipientEmail,
        status: "skipped",
        message: "Recipient no longer has an email-ready partner record.",
      });
      continue;
    }

    const values = await buildMergeValues({
      recipient,
      sender: campaignSender,
      event,
    });
    const subject = renderMergeTemplate(campaign.subject, values);
    const body = renderMergeTemplate(campaign.body, values);

    try {
      const response = await googleClient.gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodeRawEmail({
            to: recipient.email,
            subject,
            body,
          }),
        },
      });
      const externalMessageId = response.data.id ?? null;
      await updateEmailSendResult({
        sendId: send.id,
        status: "sent",
        externalMessageId,
      });
      if (campaign.senderUserId && send.companyId) {
        await logEmailInteraction({
          companyId: send.companyId,
          partnerId: send.partnerId,
          userId: campaign.senderUserId,
          subject,
          notes: `Mail merge outreach draft ${campaign.id}`,
          externalMessageId,
        });
      }
      sentCount += 1;
      results.push({ email: recipient.email, status: "sent", message: "Sent" });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Gmail send failed.";
      failedCount += 1;
      await updateEmailSendResult({
        sendId: send.id,
        status: "failed",
        error: message,
      });
      results.push({ email: recipient.email, status: "failed", message });
    }
  }

  await updateEmailCampaignStatus(campaign.id, failedCount > 0 ? "failed" : "sent");
  revalidateCrmData();

  return {
    kind: "sent" as const,
    sentCount,
    failedCount,
    skippedCount,
    results,
  };
}
