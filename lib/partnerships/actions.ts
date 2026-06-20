"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, contactActivities } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import {
  addCompanyEventRole,
  addPartnerEventRole,
  archivePartnerAccount,
  createCompanyInteraction,
  updateCompanyInteraction,
  createCompany,
  createContact,
  createDirector,
  createCrmEvent,
  createMeetingLog,
  createPartnerAccount,
  deleteCompanyInteraction,
  deleteMeetingLog,
  linkContactToCompany,
  logEventPartnerResponse,
  removeCompanyEventRole,
  removePartnerEventRole,
  updateCompany,
  updateCompanyEventStatus,
  updateContact,
  updateDirector,
  updateCrmEvent,
  updatePartnerEventStatus,
  updateMeetingLog,
  getCompanyByName,
  getCompanyLastContact,
  getPartnerByEmail,
} from "./repository";
import type {
  AddCompanyEventRoleInput,
  AddPartnerEventRoleInput,
  CreateCompanyInteractionInput,
  UpdateCompanyInteractionInput,
  CreateCompanyInput,
  CreateContactInput,
  CreateDirectorInput,
  CreateEventInput,
  CreateMeetingLogInput,
  CreatePartnerInput,
  LogEventPartnerResponseInput,
  UpdateCompanyInput,
  UpdateContactInput,
  UpdateDirectorInput,
  UpdateEventInput,
  UpdateMeetingLogInput,
} from "./types";
import { CRM_DATA_TAG } from "./cached";

const crmDataPaths = ["/", "/companies", "/partners", "/events", "/contact-log", "/settings"];

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

export async function getCompanyLastContactAction(companyId: string) {
  return getCompanyLastContact(companyId);
}

export async function getPartnerByEmailAction(email: string) {
  return getPartnerByEmail(email.trim().toLowerCase());
}

export async function getCompanyByNameAction(name: string) {
  return getCompanyByName(name.trim());
}
