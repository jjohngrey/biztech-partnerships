import { describe, expect, it } from "vitest";
import { buildCsv, csvCell, sanitizeCsvFilename } from "@/lib/csv";

describe("csv helpers", () => {
  it("escapes quotes, commas, and newlines", () => {
    expect(csvCell('Ada "Countess", first programmer\nLondon')).toBe(
      '"Ada ""Countess"", first programmer\nLondon"',
    );
  });

  it("serializes blank values as empty cells", () => {
    expect(
      buildCsv([
        ["email", "firstName", "lastName"],
        [null, "Ada", undefined],
      ]),
    ).toBe('"email","firstName","lastName"\n"","Ada",""');
  });

  it("normalizes filenames without slugging punctuation", () => {
    expect(sanitizeCsvFilename("Partner: Ada Lovelace / Initech")).toBe(
      "partner: ada lovelace / initech",
    );
  });
});
