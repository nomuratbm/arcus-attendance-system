import assert from "node:assert/strict";
import test from "node:test";
import {
  parseMemberRegistrationInput,
  planMemberRegistration,
} from "./member-registration.ts";

test("normalizes registration fields and accepts one organization", () => {
  assert.deepEqual(
    parseMemberRegistrationInput({
      full_name: "  Student Name ",
      student_id: " 2024105858 ",
      course: " CS-3 ",
      department: " CCS ",
      organization_id: " org-a ",
    }),
    {
      ok: true,
      value: {
        fullName: "Student Name",
        studentId: "2024105858",
        course: "CS-3",
        department: "CCS",
        organizationId: "org-a",
      },
    },
  );
});

test("accepts explicit no organization and rejects a missing selection", () => {
  const requiredFields = {
    full_name: "Student Name",
    student_id: "2024105858",
    course: "CS-3",
    department: "CCS",
  };

  assert.equal(
    parseMemberRegistrationInput({
      ...requiredFields,
      organization_id: null,
    }).ok,
    true,
  );
  assert.deepEqual(parseMemberRegistrationInput(requiredFields), {
    ok: false,
    reason: "invalid",
  });
});

test("plans a new registration with no organization", () => {
  assert.deepEqual(planMemberRegistration(null, ""), {
    status: "created",
    currentOrganization: "",
    staleOrganizationIds: [],
    registrationVersion: 1,
  });
});

test("plans a new registration with one organization", () => {
  assert.deepEqual(planMemberRegistration(null, " org-a "), {
    status: "created",
    currentOrganization: "org-a",
    staleOrganizationIds: [],
    registrationVersion: 1,
  });
});

test("rejects an existing registration instead of replacing it", () => {
  assert.deepEqual(planMemberRegistration(3, "org-c"), { status: "exists" });
  assert.deepEqual(planMemberRegistration(1, "org-b"), { status: "exists" });
  assert.deepEqual(planMemberRegistration(0, ""), { status: "exists" });
});
