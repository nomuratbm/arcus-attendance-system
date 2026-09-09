import { MAX_STUDENT_NUMBER_LENGTH } from "./students.ts";

export type MemberRegistrationPlan = {
  status: "created" | "replaced";
  currentOrganization: string;
  staleOrganizationIds: string[];
  registrationVersion: number;
};

export type MemberRegistrationInput = {
  fullName: string;
  studentId: string;
  course: string;
  department: string;
  organizationId: string;
};

export type MemberRegistrationInputResult =
  | { ok: true; value: MemberRegistrationInput }
  | { ok: false; reason: "invalid" | "student-number-too-long" };

export function parseMemberRegistrationInput(
  input: unknown,
): MemberRegistrationInputResult {
  if (typeof input !== "object" || input === null) {
    return { ok: false, reason: "invalid" };
  }

  const record = input as Record<string, unknown>;
  const fullName =
    typeof record.full_name === "string" ? record.full_name.trim() : "";
  const studentId =
    typeof record.student_id === "string" ? record.student_id.trim() : "";
  const course =
    typeof record.course === "string" ? record.course.trim() : "";
  const department =
    typeof record.department === "string" ? record.department.trim() : "";
  const hasOrganizationSelection =
    Object.prototype.hasOwnProperty.call(record, "organization_id") &&
    (record.organization_id === null ||
      typeof record.organization_id === "string");
  const organizationId =
    typeof record.organization_id === "string"
      ? record.organization_id.trim()
      : "";

  if (studentId.length > MAX_STUDENT_NUMBER_LENGTH) {
    return { ok: false, reason: "student-number-too-long" };
  }

  if (
    !fullName ||
    !studentId ||
    !course ||
    !department ||
    !hasOrganizationSelection
  ) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    value: {
      fullName,
      studentId,
      course,
      department,
      organizationId,
    },
  };
}

export function planMemberRegistration(
  existingRegistrationVersion: number | null,
  existingOrganizationIds: string[],
  selectedOrganizationId: string,
): MemberRegistrationPlan {
  const currentOrganization = selectedOrganizationId.trim();
  const staleOrganizationIds = Array.from(
    new Set(
      existingOrganizationIds
        .map((organizationId) => organizationId.trim())
        .filter(
          (organizationId) =>
            organizationId && organizationId !== currentOrganization,
        ),
    ),
  );

  return {
    status:
      existingRegistrationVersion === null ? "created" : "replaced",
    currentOrganization,
    staleOrganizationIds,
    registrationVersion: (existingRegistrationVersion ?? 0) + 1,
  };
}
