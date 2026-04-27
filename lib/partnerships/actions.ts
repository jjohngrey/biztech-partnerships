"use server";

import { revalidatePath } from "next/cache";
import {
  archivePartnerAccount,
  createCrmEvent,
  createPartnerAccount,
  createSponsorship,
} from "./repository";
import type {
  CreateEventInput,
  CreatePartnerInput,
  CreateSponsorshipInput,
} from "./types";

export async function createPartnerAction(input: CreatePartnerInput) {
  const partner = await createPartnerAccount(input);
  revalidatePath("/");
  revalidatePath("/partners");
  return partner;
}

export async function archivePartnerAction(companyId: string, archived = true) {
  const partner = await archivePartnerAccount(companyId, archived);
  revalidatePath("/");
  revalidatePath("/partners");
  return partner;
}

export async function createEventAction(input: CreateEventInput) {
  const event = await createCrmEvent(input);
  revalidatePath("/");
  revalidatePath("/events");
  return event;
}

export async function createSponsorshipAction(input: CreateSponsorshipInput) {
  const sponsorship = await createSponsorship(input);
  revalidatePath("/");
  revalidatePath("/partners");
  revalidatePath("/pipeline");
  return sponsorship;
}
