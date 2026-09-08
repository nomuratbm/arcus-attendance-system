import assert from "node:assert/strict";
import test from "node:test";
import {
  OrganizationCsvError,
  normalizeOrganizationName,
  parseOrganizationCsv,
} from "./organization-csv.ts";
import { parseOrganizationOptions } from "./organizations.ts";

test("parses an optional header and quoted organization names", () => {
  const rows = parseOrganizationCsv(
    'org_name,organization_id\n"Builders, Inc.",11111111-1111-4111-8111-111111111111\nSecond Org,',
    () => "22222222-2222-4222-8222-222222222222",
  );

  assert.deepEqual(rows, [
    {
      name: "Builders, Inc.",
      organizationId: "11111111-1111-4111-8111-111111111111",
      organizationIdProvided: true,
      rowNumber: 2,
    },
    {
      name: "Second Org",
      organizationId: "22222222-2222-4222-8222-222222222222",
      organizationIdProvided: false,
      rowNumber: 3,
    },
  ]);
});

test("normalizes names for case-insensitive matching", () => {
  assert.equal(normalizeOrganizationName("  AWS   Arcus  "), "aws arcus");
});

test("generates a fresh UUID for each missing second column", () => {
  let generated = 0;
  const rows = parseOrganizationCsv(
    "One\nTwo",
    () => `00000000-0000-4000-8000-${String(++generated).padStart(12, "0")}`,
  );

  assert.deepEqual(
    rows.map((row) => row.organizationId),
    [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ],
  );
});

test("rejects duplicate normalized names", () => {
  assert.throws(
    () =>
      parseOrganizationCsv(
        "Arcus,11111111-1111-4111-8111-111111111111\n arcus ,22222222-2222-4222-8222-222222222222",
      ),
    OrganizationCsvError,
  );
});

test("rejects an invalid organization UUID", () => {
  assert.throws(
    () => parseOrganizationCsv("Arcus,not-a-uuid"),
    OrganizationCsvError,
  );
});

test("public organization parsing returns only public fields", () => {
  const parsed = parseOrganizationOptions({
    organizations: [
      {
        label: "Arcus",
        value: "org-id",
        internal_field: "must-not-leak",
      },
    ],
  });

  assert.deepEqual(parsed, [{ label: "Arcus", value: "org-id" }]);
  assert.equal("internal_field" in parsed[0], false);
});
