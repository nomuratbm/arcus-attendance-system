import { MAX_STUDENT_NUMBER_LENGTH } from "./students.ts";

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/** Number of leading digits in a student number that encode the school year. */
const STUDENT_NUMBER_YEAR_DIGITS = 4;

/**
 * How many school years before the current one are still accepted.
 * The current year and the previous N years are allowed.
 */
const STUDENT_NUMBER_YEAR_SPAN = 9;

/** Maximum number of letters allowed in a program acronym (e.g. "CS"). */
const MAX_PROGRAM_CODE_LENGTH = 5;

/** Inclusive range for the year level that follows the dash (e.g. "CS-3"). */
const MIN_PROGRAM_YEAR = 1;
const MAX_PROGRAM_YEAR = 4;

// Letters only: ASCII plus the Latin extended range so accented names pass.
const NAME_ALLOWED_PATTERN = /^[A-Za-z\u00C0-\u024F' .-]+$/;
const NAME_LETTER_PATTERN = /[A-Za-z\u00C0-\u024F]/;

/**
 * Validates that a student number follows the schoolyear-sequence convention
 * (4-digit year + 6-digit sequence, e.g. 2024106767) and that the encoded year
 * falls within the current school year and the previous {@link STUDENT_NUMBER_YEAR_SPAN} years.
 */
export function validateStudentNumber(
  value: string,
  currentYear: number = new Date().getFullYear(),
): ValidationResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: false, message: "Please enter a student number." };
  }

  if (!/^\d+$/.test(trimmed)) {
    return {
      ok: false,
      message: "Student number must contain digits only.",
    };
  }

  if (trimmed.length !== MAX_STUDENT_NUMBER_LENGTH) {
    return {
      ok: false,
      message: `Student number must be ${MAX_STUDENT_NUMBER_LENGTH} digits (e.g. 2024106767).`,
    };
  }

  const year = Number(trimmed.slice(0, STUDENT_NUMBER_YEAR_DIGITS));
  const earliestYear = currentYear - STUDENT_NUMBER_YEAR_SPAN;

  if (year < earliestYear || year > currentYear) {
    return {
      ok: false,
      message: `Student number year must be between ${earliestYear} and ${currentYear}.`,
    };
  }

  return { ok: true };
}

/**
 * Validates that a student name looks like a real person's name: letters
 * (plus spaces, apostrophes, hyphens and periods) and at least two name parts.
 */
export function validateStudentName(value: string): ValidationResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: false, message: "Please enter the student's full name." };
  }

  if (/\d/.test(trimmed)) {
    return { ok: false, message: "Student name cannot contain numbers." };
  }

  if (!NAME_ALLOWED_PATTERN.test(trimmed)) {
    return {
      ok: false,
      message:
        "Student name can only contain letters, spaces, apostrophes, hyphens and periods.",
    };
  }

  const nameParts = trimmed
    .split(/\s+/)
    .filter((part) => NAME_LETTER_PATTERN.test(part));

  if (nameParts.length < 2) {
    return {
      ok: false,
      message: "Enter the student's full name (at least a first and last name).",
    };
  }

  return { ok: true };
}

/**
 * Validates the program-year field, expected as ACRONYM-YEAR where the acronym
 * is at most {@link MAX_PROGRAM_CODE_LENGTH} letters and the year is between
 * {@link MIN_PROGRAM_YEAR} and {@link MAX_PROGRAM_YEAR} (e.g. "CS-3").
 */
export function validateProgramYear(value: string): ValidationResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: false, message: "Please enter the program and year." };
  }

  const match = /^([A-Za-z]+)-(\d+)$/.exec(trimmed);

  if (!match) {
    return {
      ok: false,
      message: "Use the format PROGRAM-YEAR (e.g. CS-3).",
    };
  }

  const [, code, yearText] = match;

  if (code.length > MAX_PROGRAM_CODE_LENGTH) {
    return {
      ok: false,
      message: `Program acronym must be ${MAX_PROGRAM_CODE_LENGTH} letters or fewer (e.g. CS-3).`,
    };
  }

  const year = Number(yearText);

  if (year < MIN_PROGRAM_YEAR || year > MAX_PROGRAM_YEAR) {
    return {
      ok: false,
      message: `Year must be between ${MIN_PROGRAM_YEAR} and ${MAX_PROGRAM_YEAR}.`,
    };
  }

  return { ok: true };
}
