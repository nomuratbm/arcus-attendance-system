import "server-only";

import {
  BatchGetCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamodb, tableName } from "@/lib/dynamodb/client";
import {
  normalizeOrganizationName,
} from "@/lib/organization-csv";
import type { OrganizationOption } from "@/lib/organizations";
import {
  organizationIdFromKey,
  organizationItemKey,
} from "@/store/dynamodb-keys";

export const ORGANIZATION_GSI4PK = "ORGANIZATION";
export const ORGANIZATION_GSI4_NAME = "GSI4";

type OrganizationRecord = OrganizationOption & {
  normalizedName: string;
};

export type OrganizationImportRow = {
  name: string;
  organizationId: string;
  organizationIdProvided: boolean;
  rowNumber: number;
};

export class OrganizationImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizationImportError";
  }
}

export type OrganizationImportResult = {
  name: string;
  status: "created" | "updated";
};

export async function listOrganizations(): Promise<OrganizationOption[]> {
  return (await listOrganizationRecords()).map(({ label, value }) => ({
    label,
    value,
  }));
}

export async function getOrganization(
  organizationId: string,
): Promise<OrganizationOption | null> {
  const key = organizationItemKey(organizationId);
  const result = await dynamodb.send(
    new GetCommand({
      TableName: tableName(),
      Key: { PK: key, SK: key },
      ProjectionExpression: "PK, SK, org_name, normalized_org_name",
    }),
  );

  const record = result.Item
    ? organizationFromRecord(result.Item as Record<string, unknown>)
    : null;
  return record ? { label: record.label, value: record.value } : null;
}

export async function getOrganizations(
  organizationIds: string[],
): Promise<OrganizationOption[]> {
  const requestedIds = Array.from(
    new Set(organizationIds.map((value) => value.trim()).filter(Boolean)),
  );
  if (requestedIds.length === 0) {
    return [];
  }

  const found = new Map<string, OrganizationOption>();
  const name = tableName();

  for (let offset = 0; offset < requestedIds.length; offset += 100) {
    let keys = requestedIds.slice(offset, offset + 100).map((organizationId) => {
      const key = organizationItemKey(organizationId);
      return { PK: key, SK: key };
    });

    while (keys.length > 0) {
      const result = await dynamodb.send(
        new BatchGetCommand({
          RequestItems: {
            [name]: {
              Keys: keys,
              ProjectionExpression: "PK, SK, org_name, normalized_org_name",
            },
          },
        }),
      );

      for (const item of result.Responses?.[name] ?? []) {
        const record = organizationFromRecord(
          item as Record<string, unknown>,
        );
        if (record) {
          found.set(record.value, {
            label: record.label,
            value: record.value,
          });
        }
      }

      keys = (result.UnprocessedKeys?.[name]?.Keys ?? []) as {
        PK: string;
        SK: string;
      }[];
    }
  }

  return requestedIds.flatMap((organizationId) => {
    const organization = found.get(organizationId);
    return organization ? [organization] : [];
  });
}

export async function upsertOrganizations(
  rows: OrganizationImportRow[],
): Promise<OrganizationImportResult[]> {
  const existing = await listOrganizationRecords();
  const byNormalizedName = new Map(
    existing.map((organization) => [
      organization.normalizedName,
      organization,
    ]),
  );
  const byOrganizationId = new Map(
    existing.map((organization) => [organization.value, organization]),
  );
  const results: OrganizationImportResult[] = [];

  for (let offset = 0; offset < rows.length; offset += 10) {
    const chunk = rows.slice(offset, offset + 10);
    const chunkResults = await Promise.all(
      chunk.map(async (row): Promise<OrganizationImportResult> => {
        const normalizedName = normalizeOrganizationName(row.name);
        const existingOrganization = byNormalizedName.get(normalizedName);

        if (existingOrganization) {
          if (
            row.organizationIdProvided &&
            row.organizationId !== existingOrganization.value
          ) {
            throw new OrganizationImportError(
              `Row ${row.rowNumber} uses UUID "${row.organizationId}" for "${row.name}", but that organization already uses UUID "${existingOrganization.value}".`,
            );
          }
          await updateOrganization(
            existingOrganization.value,
            row.name,
            normalizedName,
          );
          return { name: row.name, status: "updated" };
        }

        const organizationWithId = byOrganizationId.get(row.organizationId);
        if (organizationWithId) {
          throw new OrganizationImportError(
            `Row ${row.rowNumber} uses UUID "${row.organizationId}", which already belongs to "${organizationWithId.label}".`,
          );
        }

        await createOrganization(
          row.organizationId,
          row.name,
          normalizedName,
        );
        byNormalizedName.set(normalizedName, {
          label: row.name,
          normalizedName,
          value: row.organizationId,
        });
        byOrganizationId.set(row.organizationId, {
          label: row.name,
          normalizedName,
          value: row.organizationId,
        });
        return { name: row.name, status: "created" };
      }),
    );
    results.push(...chunkResults);
  }

  return results;
}

async function listOrganizationRecords(): Promise<OrganizationRecord[]> {
  const records: OrganizationRecord[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await dynamodb.send(
      new QueryCommand({
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
        TableName: tableName(),
        IndexName: ORGANIZATION_GSI4_NAME,
        KeyConditionExpression: "GSI4PK = :organization",
        ExpressionAttributeValues: {
          ":organization": ORGANIZATION_GSI4PK,
        },
        ProjectionExpression: "PK, SK, org_name, normalized_org_name",
        ScanIndexForward: true,
      }),
    );

    for (const item of result.Items ?? []) {
      const organization = organizationFromRecord(
        item as Record<string, unknown>,
      );
      if (organization) {
        records.push(organization);
      }
    }

    exclusiveStartKey = result.LastEvaluatedKey as
      | Record<string, unknown>
      | undefined;
  } while (exclusiveStartKey);

  return records;
}

async function createOrganization(
  organizationId: string,
  name: string,
  normalizedName: string,
): Promise<void> {
  const key = organizationItemKey(organizationId);
  await dynamodb.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        PK: key,
        SK: key,
        GSI4PK: ORGANIZATION_GSI4PK,
        GSI4SK: `${normalizedName}#${organizationId}`,
        organization_id: organizationId,
        org_name: name,
        normalized_org_name: normalizedName,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );
}

async function updateOrganization(
  organizationId: string,
  name: string,
  normalizedName: string,
): Promise<void> {
  const key = organizationItemKey(organizationId);
  await dynamodb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { PK: key, SK: key },
      UpdateExpression:
        "SET GSI4PK = :gsi4pk, GSI4SK = :gsi4sk, organization_id = :organizationId, org_name = :name, normalized_org_name = :normalizedName REMOVE crypto_key",
      ExpressionAttributeValues: {
        ":gsi4pk": ORGANIZATION_GSI4PK,
        ":gsi4sk": `${normalizedName}#${organizationId}`,
        ":organizationId": organizationId,
        ":name": name,
        ":normalizedName": normalizedName,
      },
      ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
    }),
  );
}

function organizationFromRecord(
  item: Record<string, unknown>,
): OrganizationRecord | null {
  const pk = typeof item.PK === "string" ? item.PK : "";
  const sk = typeof item.SK === "string" ? item.SK : "";
  const label = typeof item.org_name === "string" ? item.org_name.trim() : "";
  const value = organizationIdFromKey(pk);

  if (
    !pk.startsWith("ORGANIZATION#") ||
    sk !== pk ||
    !label ||
    !value
  ) {
    return null;
  }

  const normalizedName =
    typeof item.normalized_org_name === "string" &&
    item.normalized_org_name.trim()
      ? item.normalized_org_name
      : normalizeOrganizationName(label);

  return { label, normalizedName, value };
}
