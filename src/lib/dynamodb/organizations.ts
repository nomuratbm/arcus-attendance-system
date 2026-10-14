import "server-only";

import {
  BatchGetCommand,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamodb, tableName } from "@/lib/dynamodb/client";
import type { OrganizationOption } from "@/lib/organizations";
import {
  organizationIdFromKey,
  organizationItemKey,
} from "@/store/dynamodb-keys";

/**
 * Organizations are owned by the mapua-apex backend: one item per org at
 * PK = SK = ORGANIZATION#<uuid> carrying `name` (plus `signatories` and
 * `is_higher_council`, which this app does not read). The former arcus-shaped
 * registry (org_name / normalized_org_name / GSI4) is deprecated — orgs are
 * created and edited in the apex admin, never here. This module is read-only.
 */

type OrganizationRecord = OrganizationOption;

export async function listOrganizations(): Promise<OrganizationOption[]> {
  const records = await listOrganizationRecords();
  return records
    .map(({ label, value }) => ({ label, value }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export async function getOrganization(
  organizationId: string,
): Promise<OrganizationOption | null> {
  const key = organizationItemKey(organizationId);
  const result = await dynamodb.send(
    new GetCommand({
      TableName: tableName(),
      Key: { PK: key, SK: key },
      ProjectionExpression: "PK, SK, name",
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
              ProjectionExpression: "PK, SK, name",
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

async function listOrganizationRecords(): Promise<OrganizationRecord[]> {
  const records: OrganizationRecord[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await dynamodb.send(
      new ScanCommand({
        ...(exclusiveStartKey
          ? { ExclusiveStartKey: exclusiveStartKey }
          : {}),
        TableName: tableName(),
        FilterExpression: "begins_with(PK, :prefix) AND PK = SK",
        ExpressionAttributeValues: {
          ":prefix": "ORGANIZATION#",
        },
        ProjectionExpression: "PK, SK, name",
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

function organizationFromRecord(
  item: Record<string, unknown>,
): OrganizationRecord | null {
  const pk = typeof item.PK === "string" ? item.PK : "";
  const sk = typeof item.SK === "string" ? item.SK : "";
  const label = typeof item.name === "string" ? item.name.trim() : "";
  const value = organizationIdFromKey(pk);

  if (
    !pk.startsWith("ORGANIZATION#") ||
    sk !== pk ||
    !label ||
    !value
  ) {
    return null;
  }

  return { label, value };
}
