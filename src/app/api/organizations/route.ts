import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/session";
import {
  MAX_ORGANIZATION_CSV_BYTES,
  OrganizationCsvError,
  parseOrganizationCsv,
} from "@/lib/organization-csv";
import {
  listOrganizations,
  OrganizationImportError,
  upsertOrganizations,
} from "@/lib/dynamodb/organizations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const organizations = await listOrganizations();
    return NextResponse.json(
      { organizations },
      { headers: { "Cache-Control": "no-store" }, status: 200 },
    );
  } catch (error) {
    console.error("Error listing organizations:", error);
    return NextResponse.json(
      { error: "Failed to load organizations" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const organizationName = formData.get("name");
    const organizationId = formData.get("organization_id");
    let csvText: string;

    if (file instanceof File) {
      const isCsv =
        file.name.toLocaleLowerCase("en-US").endsWith(".csv") ||
        file.type === "text/csv" ||
        file.type === "application/vnd.ms-excel";
      if (!isCsv) {
        return NextResponse.json(
          { error: "Only CSV files are supported" },
          { status: 400 },
        );
      }

      if (file.size === 0 || file.size > MAX_ORGANIZATION_CSV_BYTES) {
        return NextResponse.json(
          { error: "The CSV file must be between 1 byte and 1 MB" },
          { status: 400 },
        );
      }
      csvText = await file.text();
    } else if (typeof organizationName === "string") {
      csvText = [
        csvCell(organizationName),
        csvCell(typeof organizationId === "string" ? organizationId : ""),
      ].join(",");
    } else {
      return NextResponse.json(
        { error: "A CSV file or organization name is required" },
        { status: 400 },
      );
    }

    const rows = parseOrganizationCsv(csvText);
    const results = await upsertOrganizations(
      rows.map(
        ({ name, organizationId, organizationIdProvided, rowNumber }) => ({
          name,
          organizationId,
          organizationIdProvided,
          rowNumber,
        }),
      ),
    );
    const created = results.filter(
      (result) => result.status === "created",
    ).length;
    const updated = results.length - created;

    return NextResponse.json(
      {
        success: true,
        created,
        updated,
        total: results.length,
        results,
      },
      { status: 200 },
    );
  } catch (error) {
    if (
      error instanceof OrganizationCsvError ||
      error instanceof OrganizationImportError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Error importing organizations:", error);
    return NextResponse.json(
      { error: "Failed to import organizations" },
      { status: 500 },
    );
  }
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
