import assert from "node:assert/strict";
import test from "node:test";
import { parseStudentRegistrationInput } from "./student-registration.ts";

test("normalizes registration fields", () => {
  assert.deepEqual(
    parseStudentRegistrationInput({
      full_name: "  Student Name ",
      student_id: " 2024105858 ",
      course: " CS-3 ",
      department: " CCS ",
    }),
    {
      ok: true,
      value: {
        fullName: "Student Name",
        studentId: "2024105858",
        course: "CS-3",
        department: "CCS",
      },
    },
  );
});

test("rejects a missing required field", () => {
  assert.deepEqual(
    parseStudentRegistrationInput({
      full_name: "Student Name",
      student_id: "2024105858",
      course: "CS-3",
    }),
    {
      ok: false,
      reason: "invalid",
    },
  );
});

test("rejects a student number that is too long", () => {
  assert.deepEqual(
    parseStudentRegistrationInput({
      full_name: "Student Name",
      student_id: "20241058589999",
      course: "CS-3",
      department: "CCS",
    }),
    {
      ok: false,
      reason: "student-number-too-long",
    },
  );
});
