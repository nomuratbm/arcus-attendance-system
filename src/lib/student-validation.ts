import {
  getDepartmentItem,
  getDepartmentPrograms,
  getYearLevelOptions,
} from "./academic-options.ts";
import {
  MAX_STUDENT_NUMBER_LENGTH,
  STUDENT_NUMBER_PATTERN,
  STUDENT_NUMBER_YEAR_LENGTH,
} from "./students.ts";

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * How many school years before the current one are still accepted.
 * The current year and the previous N years are allowed.
 */
const STUDENT_NUMBER_YEAR_SPAN = 9;

/** First name length, matching the proponent form cap. */
export const FIRST_NAME_MIN = 2;
export const FIRST_NAME_MAX = 35;

/** Last name length, matching the proponent form cap. */
export const LAST_NAME_MIN = 2;
export const LAST_NAME_MAX = 30;

// Letters only: ASCII plus the Latin extended range so accented names pass.
const NAME_ALLOWED_PATTERN = /^[A-Za-z\u00C0-\u024F' .-]+$/;
const NAME_LETTER_PATTERN = /[A-Za-z\u00C0-\u024F]/;

/**
 * Validates that a student number is exactly {@link MAX_STUDENT_NUMBER_LENGTH}
 * characters: a 4-digit year, then 6 digits, with the year inside the allowed span.
 */
export function validateStudentNumber(
  value: string,
  currentYear: number = new Date().getFullYear(),
): ValidationResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: false, message: "Please enter a student number." };
  }

  const match = STUDENT_NUMBER_PATTERN.exec(trimmed);
  if (!match || trimmed.length !== MAX_STUDENT_NUMBER_LENGTH) {
    return {
      ok: false,
      message: `Student number must be a ${STUDENT_NUMBER_YEAR_LENGTH}-digit year followed by 6 digits (e.g. 2024106767).`,
    };
  }

  const year = Number(match[1]);
  const earliestYear = currentYear - STUDENT_NUMBER_YEAR_SPAN;

  if (year < earliestYear || year > currentYear) {
    return {
      ok: false,
      message: `Student number year must be between ${earliestYear} and ${currentYear}.`,
    };
  }

  return { ok: true };
}

function validateNamePart(
  value: string,
  label: "First name" | "Last name",
  min: number,
  max: number,
): ValidationResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: false, message: `Please enter the student's ${label.toLowerCase()}.` };
  }

  if (trimmed.length < min || trimmed.length > max) {
    return {
      ok: false,
      message: `${label} must be ${min} to ${max} characters.`,
    };
  }

  if (/\d/.test(trimmed) || !NAME_ALLOWED_PATTERN.test(trimmed)) {
    return {
      ok: false,
      message: `${label} can only contain letters, spaces, apostrophes, hyphens and periods.`,
    };
  }

  if (!NAME_LETTER_PATTERN.test(trimmed)) {
    return {
      ok: false,
      message: `${label} must include at least one letter.`,
    };
  }

  return { ok: true };
}

export function validateFirstName(value: string): ValidationResult {
  return validateNamePart(value, "First name", FIRST_NAME_MIN, FIRST_NAME_MAX);
}

export function validateLastName(value: string): ValidationResult {
  return validateNamePart(value, "Last name", LAST_NAME_MIN, LAST_NAME_MAX);
}

/** Joins the two form fields into the single full_name stored on the student. */
export function formatStudentName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

/**
 * Validates the department, program, and year chosen the same way a SAAF
 * proponent does: the program must belong to the department, and the year
 * must be a college year or an SHS grade for that department.
 */
export function validateProgramAndYear(
  department: string,
  program: string,
  yearLevel: string,
): ValidationResult {
  if (!department.trim() || !getDepartmentItem(department)) {
    return { ok: false, message: "Select a department from the list." };
  }

  if (!program.trim() || !yearLevel.trim()) {
    return {
      ok: false,
      message: "Both program and year level are required.",
    };
  }

  const offered = getDepartmentPrograms(department).some(
    (item) => item.code === program,
  );
  if (!offered) {
    return {
      ok: false,
      message: "Select a program offered by that department.",
    };
  }

  if (!getYearLevelOptions(department).includes(yearLevel)) {
    return {
      ok: false,
      message: "Select a year level for that department.",
    };
  }

  return { ok: true };
}
