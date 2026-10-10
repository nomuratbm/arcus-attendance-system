import assert from "node:assert/strict";
import test from "node:test";
import {
  validateProgramYear,
  validateStudentName,
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

test("rejects malformed student numbers", () => {
  assert.equal(validateStudentNumber("", CURRENT_YEAR).ok, false);
  assert.equal(validateStudentNumber("2024abc767", CURRENT_YEAR).ok, false);
  assert.equal(validateStudentNumber("20241067", CURRENT_YEAR).ok, false);
});

test("accepts a real name with at least two parts", () => {
  assert.equal(validateStudentName("John Benedict Vida").ok, true);
  assert.equal(validateStudentName("Maria Dela Cruz-Smith").ok, true);
  assert.equal(validateStudentName("José Rizal").ok, true);
});

test("rejects single-word, numeric and symbol-laden names", () => {
  assert.equal(validateStudentName("Cher").ok, false);
  assert.equal(validateStudentName("John123 Smith").ok, false);
  assert.equal(validateStudentName("John $mith").ok, false);
  assert.equal(validateStudentName("   ").ok, false);
});

test("accepts a valid program-year", () => {
  assert.equal(validateProgramYear("CS-3").ok, true);
  assert.equal(validateProgramYear("BSIT-1").ok, true);
  assert.equal(validateProgramYear("ABCDE-4").ok, true);
});

test("rejects an out-of-range year level", () => {
  assert.equal(validateProgramYear("CS-0").ok, false);
  assert.equal(validateProgramYear("CS-5").ok, false);
});

test("rejects a too-long acronym or bad format", () => {
  assert.equal(validateProgramYear("ABCDEF-3").ok, false);
  assert.equal(validateProgramYear("CS3").ok, false);
  assert.equal(validateProgramYear("CS-").ok, false);
  assert.equal(validateProgramYear("").ok, false);
});
