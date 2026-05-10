import { describe, it, expect } from "vitest";
import { renderMergeTemplate, buildMergeValues } from "../repository";
import type { EmailRecipientRecord, CrmUserSummary, CrmEventSummary } from "../types";

describe("renderMergeTemplate", () => {
  it("substitutes a single token", () => {
    expect(renderMergeTemplate("Hello {{contact_name}}", { contact_name: "Ada" })).toBe(
      "Hello Ada",
    );
  });

  it("substitutes multiple tokens", () => {
    const result = renderMergeTemplate(
      "Hi {{recipient_first_name}}, this is {{sender_first_name}} from BizTech",
      { recipient_first_name: "Sam", sender_first_name: "Jess" },
    );
    expect(result).toBe("Hi Sam, this is Jess from BizTech");
  });

  it("tolerates whitespace inside delimiters", () => {
    expect(renderMergeTemplate("Hi {{  contact_name  }}", { contact_name: "Ada" })).toBe(
      "Hi Ada",
    );
  });

  it("matches token names case-insensitively", () => {
    expect(renderMergeTemplate("Hi {{Contact_Name}}", { contact_name: "Ada" })).toBe(
      "Hi Ada",
    );
  });

  it("replaces missing tokens with empty string", () => {
    expect(renderMergeTemplate("Hello {{missing}}!", {})).toBe("Hello !");
  });

  it("does not mutate text outside of tokens", () => {
    const template = "Plain text — no tokens here";
    expect(renderMergeTemplate(template, { contact_name: "ignored" })).toBe(template);
  });

  it("ignores unknown delimiter syntax", () => {
    // Single braces should not be treated as merge tokens.
    expect(renderMergeTemplate("{contact_name}", { contact_name: "Ada" })).toBe(
      "{contact_name}",
    );
  });

  it("is reentrant — repeated calls produce identical output (regex lastIndex reset)", () => {
    const template = "{{contact_name}} {{company_name}}";
    const values = { contact_name: "Ada", company_name: "Initech" };
    const first = renderMergeTemplate(template, values);
    const second = renderMergeTemplate(template, values);
    const third = renderMergeTemplate(template, values);
    expect(first).toBe("Ada Initech");
    expect(second).toBe("Ada Initech");
    expect(third).toBe("Ada Initech");
  });
});

describe("buildMergeValues", () => {
  const baseRecipient: EmailRecipientRecord = {
    id: "r1",
    companyId: "c1",
    companyName: "Initech",
    contactName: "Ada Lovelace",
    email: "ada@initech.com",
    latestStatus: null,
  };

  const sender: CrmUserSummary = {
    id: "u1",
    firstName: "Jess",
    lastName: "Park",
    name: "Jess Park",
    email: "jess@biztech.org",
    role: "member",
    team: "partnerships",
  };

  const event: CrmEventSummary = {
    id: "e1",
    name: "Fall Showcase",
    year: 2026,
    startDate: "2026-10-01",
    endDate: null,
    outreachStartDate: null,
    sponsorshipGoal: null,
    confirmedPartnerGoal: null,
    notes: null,
    archived: false,
    securedValue: 0,
    pipelineValue: 0,
    sponsorCount: 0,
    confirmedPartnerCount: 0,
    partnerResponses: [],
    directors: [],
  };

  it("expands recipient name into first/last/full", async () => {
    const values = await buildMergeValues({ recipient: baseRecipient });
    expect(values.recipient_first_name).toBe("Ada");
    expect(values.recipient_last_name).toBe("Lovelace");
    expect(values.recipient_full_name).toBe("Ada Lovelace");
  });

  it("falls back to email local-part when contactName is empty", async () => {
    const values = await buildMergeValues({
      recipient: { ...baseRecipient, contactName: "", email: "noreply@example.com" },
    });
    expect(values.recipient_first_name).toBe("noreply@example.com");
  });

  it("populates company and contact name verbatim", async () => {
    const values = await buildMergeValues({ recipient: baseRecipient });
    expect(values.company_name).toBe("Initech");
    expect(values.contact_name).toBe("Ada Lovelace");
    expect(values.recipient_email).toBe("ada@initech.com");
  });

  it("expands sender name and email when provided", async () => {
    const values = await buildMergeValues({ recipient: baseRecipient, sender });
    expect(values.sender_first_name).toBe("Jess");
    expect(values.sender_last_name).toBe("Park");
    expect(values.sender_full_name).toBe("Jess Park");
    expect(values.sender_email).toBe("jess@biztech.org");
  });

  it("uses empty strings for sender fields when sender is null/undefined", async () => {
    const noSender = await buildMergeValues({ recipient: baseRecipient, sender: null });
    expect(noSender.sender_first_name).toBe("");
    expect(noSender.sender_last_name).toBe("");
    expect(noSender.sender_full_name).toBe("");
    expect(noSender.sender_email).toBe("");
  });

  it("populates event name and year when an event is provided", async () => {
    const values = await buildMergeValues({ recipient: baseRecipient, event });
    expect(values.event_name).toBe("Fall Showcase");
    expect(values.event_year).toBe("2026");
  });

  it("uses empty strings for event fields when event is null/undefined", async () => {
    const values = await buildMergeValues({ recipient: baseRecipient });
    expect(values.event_name).toBe("");
    expect(values.event_year).toBe("");
  });

  it("returns event_year as empty when event has no year", async () => {
    const values = await buildMergeValues({
      recipient: baseRecipient,
      event: { ...event, year: null },
    });
    expect(values.event_year).toBe("");
  });

  it("composes with renderMergeTemplate to produce a substitutable record", async () => {
    const values = await buildMergeValues({ recipient: baseRecipient, sender, event });
    const subject = renderMergeTemplate(
      "{{sender_first_name}} <> {{company_name}} for {{event_name}}",
      values,
    );
    expect(subject).toBe("Jess <> Initech for Fall Showcase");
  });
});
