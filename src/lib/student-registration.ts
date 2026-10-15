import { MAX_STUDENT_NUMBER_LENGTH } from "./students.ts";

export type StudentRegistrationInput = {
  fullName: string;
  studentId: string;
  course: string;
  department: string;
};

export type StudentRegistrationInputResult =
  | { ok: true; value: StudentRegistrationInput }
  | { ok: false; reason: "invalid" | "student-number-too-long" };

export function parseStudentRegistrationInput(
  input: unknown,
): StudentRegistrationInputResult {
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

  if (studentId.length > MAX_STUDENT_NUMBER_LENGTH) {
    return { ok: false, reason: "student-number-too-long" };
  }

  if (!fullName || !studentId || !course || !department) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    value: {
      fullName,
      studentId,
      course,
      department,
    },
  };
}
