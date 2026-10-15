/** A student number is a 4-digit admission year plus a 6-digit sequence. */
export const STUDENT_NUMBER_YEAR_LENGTH = 4;
export const STUDENT_NUMBER_SEQUENCE_LENGTH = 6;
export const MAX_STUDENT_NUMBER_LENGTH =
  STUDENT_NUMBER_YEAR_LENGTH + STUDENT_NUMBER_SEQUENCE_LENGTH;

/**
 * Whole value, nothing else: ASCII year digits, then exactly six ASCII digits.
 * `\d` is not unicode-aware here, so full-width digits do not match.
 */
export const STUDENT_NUMBER_PATTERN = /^(\d{4})(\d{6})$/;
