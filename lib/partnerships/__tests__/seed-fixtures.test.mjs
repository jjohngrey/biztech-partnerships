import { describe, expect, it } from "vitest";
import {
  assertValidFixtureSet,
  localFixtures,
  keyBy,
  moneyToCents,
} from "../../../scripts/partnerships-dev-fixtures.mjs";

describe("partnerships dev fixtures", () => {
  it("keeps the checked-in local fixture graph internally consistent", () => {
    expect(() => assertValidFixtureSet(localFixtures)).not.toThrow();
  });

  it("fails when a contact references an unknown company", () => {
    const invalidFixtures = structuredClone(localFixtures);
    invalidFixtures.contacts[0].companyName = "Missing Sponsor Co";

    expect(() => assertValidFixtureSet(invalidFixtures)).toThrow(
      "Contact maya.chen@example.linear.app references unknown company: Missing Sponsor Co",
    );
  });

  it("fails when a document references an unknown sponsorship", () => {
    const invalidFixtures = structuredClone(localFixtures);
    invalidFixtures.documents[0].sponsorshipId = "99999999-9999-4999-8999-999999999999";

    expect(() => assertValidFixtureSet(invalidFixtures)).toThrow(
      "Document 66666666-6666-4666-8666-666666666601 references unknown sponsorship: 99999999-9999-4999-8999-999999999999",
    );
  });

  it("fails when a meeting references an unknown attendee", () => {
    const invalidFixtures = structuredClone(localFixtures);
    invalidFixtures.meetings[0].attendeeEmails = ["missing@ubcbiztech.com"];

    expect(() => assertValidFixtureSet(invalidFixtures)).toThrow(
      "Meeting 99999999-9999-4999-8999-999999999901 references unknown attendee: missing@ubcbiztech.com",
    );
  });

  it("detects duplicate keys while building reference maps", () => {
    expect(() =>
      keyBy(
        [
          { email: "duplicate@example.com" },
          { email: "duplicate@example.com" },
        ],
        (item) => item.email,
        "contact",
      ),
    ).toThrow("Duplicate contact fixture key: duplicate@example.com");
  });

  it("maps dollar amounts into integer cents", () => {
    expect(moneyToCents(1500)).toBe(150000);
    expect(moneyToCents(19.99)).toBe(1999);
  });
});
