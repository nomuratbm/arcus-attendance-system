import assert from "node:assert/strict";
import test from "node:test";
import {
  validateFirstName,
  validateLastName,
  validateProgramAndYear,
  validateStudentNumber,
} from "./student-validation.ts";

const CURRENT_YEAR = 2026;

test("accepts a well-formed student number within the allowed year span", () => {
  assert.equal(validateStudentNumber("2024106767", CURRENT_YEAR).ok, true);
  // Current year and 9 years back are both allowed.
  assert.equal(validateStudentNumber("2026000001", CURRENT_YEAR).ok, true);
  assert.equal(validateStudentNumber("2017999999", CURRENT_YEAR).ok, true);
});

test("rejects a student number year outside the allowed span", () => {
  // 2016 is 10 years before 2026, outside the 9-year span.
  const tooOld = validateStudentNumber("2016106767", CURRENT_YEAR);
  assert.equal(tooOld.ok, false);
  const future = validateStudentNumber("2027106767", CURRENT_YEAR);
  assert.equal(future.ok, false);
});

test("rejects a student number that is not a year plus 6 digits", () => {
  assert.equal(validateStudentNumber("", CURRENT_YEAR).ok, false);
  assert.equal(validateStudentNumber("2024abc767", CURRENT_YEAR).ok, false);
  assert.equal(validateStudentNumber("20241067", CURRENT_YEAR).ok, false);
  assert.equal(validateStudentNumber("20241067670", CURRENT_YEAR).ok, false);
  assert.equal(validateStudentNumber("2024 106767", CURRENT_YEAR).ok, false);
  assert.equal(validateStudentNumber("２０２４１０６７６７", CURRENT_YEAR).ok, false);
});

test("accepts first and last names inside the length caps", () => {
  assert.equal(validateFirstName("John Benedict").ok, true);
  assert.equal(validateLastName("Dela Cruz-Smith").ok, true);
  assert.equal(validateFirstName("José").ok, true);
});

test("rejects names outside the caps or with numbers", () => {
  assert.equal(validateFirstName("J").ok, false);
  assert.equal(validateFirstName("A".repeat(36)).ok, false);
  assert.equal(validateLastName("V").ok, false);
  assert.equal(validateLastName("A".repeat(31)).ok, false);
  assert.equal(validateFirstName("John2").ok, false);
  assert.equal(validateLastName("   ").ok, false);
});

test("accepts a program and year offered by the department", () => {
  assert.equal(validateProgramAndYear("SOIT", "BSCS", "3rd Year").ok, true);
  assert.equal(validateProgramAndYear("SHS-MAKATI", "STEM", "11").ok, true);
});

test("rejects a year level that does not belong to the department", () => {
  assert.equal(validateProgramAndYear("SOIT", "BSCS", "11").ok, false);
  assert.equal(validateProgramAndYear("SHS-INTRA", "STEM", "1st Year").ok, false);
});

test("rejects a program from another department or a missing choice", () => {
  assert.equal(validateProgramAndYear("SOIT", "BSN", "1st Year").ok, false);
  assert.equal(validateProgramAndYear("", "BSCS", "1st Year").ok, false);
  assert.equal(validateProgramAndYear("SOIT", "", "").ok, false);
});
