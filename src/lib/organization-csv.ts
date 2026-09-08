import { parse } from "csv-parse/sync";

export const MAX_ORGANIZATION_CSV_ROWS = 1000;
export const MAX_ORGANIZATION_CSV_BYTES = 1024 * 1024;

export type ParsedOrganizationRow = {
  name: string;
  organizationId: string;
  organizationIdProvided: boolean;
  rowNumber: number;
};

export class OrganizationCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizationCsvError";
  }
}

export function normalizeOrganizationName(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

export function parseOrganizationCsv(
  text: string,
  generateOrganizationId: () => string = () => crypto.randomUUID(),
): ParsedOrganizationRow[] {
  let parsed: unknown;

  try {
    parsed = parse(text, {
      bom: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch {
    throw new OrganizationCsvError("The CSV file could not be parsed.");
  }

  if (!Array.isArray(parsed)) {
    throw new OrganizationCsvError("The CSV file has an invalid format.");
  }

  const rows = parsed.map((value, index) => {
    if (!Array.isArray(value) || value.some((cell) => typeof cell !== "string")) {
      throw new OrganizationCsvError(`Row ${index + 1} is invalid.`);
    }
    return value as string[];
  });

  const hasHeader = rows.length > 0 && isHeaderRow(rows[0]);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const firstDataRowNumber = hasHeader ? 2 : 1;

  if (dataRows.length === 0) {
    throw new OrganizationCsvError(
      "The CSV file must contain at least one organization.",
    );
  }

  if (dataRows.length > MAX_ORGANIZATION_CSV_ROWS) {
    throw new OrganizationCsvError(
      `The CSV file cannot contain more than ${MAX_ORGANIZATION_CSV_ROWS} organizations.`,
    );
  }

  const normalizedNames = new Set<string>();
  const organizationIds = new Set<string>();

  return dataRows.map((row, index) => {
    const rowNumber = firstDataRowNumber + index;
    if (row.length < 1 || row.length > 2) {
      throw new OrganizationCsvError(
        `Row ${rowNumber} must contain one or two columns.`,
      );
    }

    const name = row[0].trim();
    const providedOrganizationId = row[1]?.trim().toLocaleLowerCase("en-US") ?? "";

    if (!name) {
      throw new OrganizationCsvError(
        `Row ${rowNumber} is missing an organization name.`,
      );
    }

    if (name.length > 200) {
      throw new OrganizationCsvError(
        `Row ${rowNumber} has an organization name longer than 200 characters.`,
      );
    }

    if (providedOrganizationId && !isUuid(providedOrganizationId)) {
      throw new OrganizationCsvError(
        `Row ${rowNumber} has an invalid organization UUID.`,
      );
    }

    const normalizedName = normalizeOrganizationName(name);
    if (normalizedNames.has(normalizedName)) {
      throw new OrganizationCsvError(
        `Row ${rowNumber} duplicates the organization "${name}".`,
      );
    }
    normalizedNames.add(normalizedName);

    const organizationId =
      providedOrganizationId || generateOrganizationId();
    if (!isUuid(organizationId)) {
      throw new OrganizationCsvError(
        `Row ${rowNumber} generated an invalid organization UUID.`,
      );
    }
    if (organizationIds.has(organizationId)) {
      throw new OrganizationCsvError(
        `Row ${rowNumber} duplicates organization UUID "${organizationId}".`,
      );
    }
    organizationIds.add(organizationId);

    return {
      name,
      organizationId,
      organizationIdProvided: Boolean(providedOrganizationId),
      rowNumber,
    };
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isHeaderRow(row: string[]): boolean {
  const firstColumn = normalizeOrganizationName(row[0] ?? "").replace(
    /[_-]/g,
    " ",
  );
  return [
    "name",
    "org name",
    "organization",
    "organization name",
  ].includes(firstColumn);
}
