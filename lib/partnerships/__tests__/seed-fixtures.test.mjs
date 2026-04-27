import { describe, expect, it } from "vitest";
import {
  assertValidFixtureSet,
  demoFixtures,
  keyBy,
  moneyToCents,
} from "../../../scripts/partnerships-dev-fixtures.mjs";

describe("partnerships dev fixtures", () => {
  it("keeps the checked-in demo fixture graph internally consistent", () => {
    expect(() => assertValidFixtureSet(demoFixtures)).not.toThrow();
  });

  it("fails when a contact references an unknown company", () => {
    const invalidFixtures = structuredClone(demoFixtures);
    invalidFixtures.contacts[0].companyName = "Missing Sponsor Co";

    expect(() => assertValidFixtureSet(invalidFixtures)).toThrow(
      "Contact maya.chen@example.linear.app references unknown company: Missing Sponsor Co",
    );
  });

  it("fails when a document references an unknown sponsorship", () => {
    const invalidFixtures = structuredClone(demoFixtures);
    invalidFixtures.documents[0].sponsorshipId = "99999999-9999-4999-8999-999999999999";

    expect(() => assertValidFixtureSet(invalidFixtures)).toThrow(
      "Document 66666666-6666-4666-8666-666666666601 references unknown sponsorship: 99999999-9999-4999-8999-999999999999",
    );
  });

  it("detects duplicate keys while building reference maps", () => {
    expect(() =>
      keyBy(
        [
          { email: "demo@example.com" },
          { email: "demo@example.com" },
        ],
        (item) => item.email,
        "contact",
      ),
    ).toThrow("Duplicate contact fixture key: demo@example.com");
  });

  it("maps dollar amounts into integer cents", () => {
    expect(moneyToCents(1500)).toBe(150000);
    expect(moneyToCents(19.99)).toBe(1999);
  });
});
