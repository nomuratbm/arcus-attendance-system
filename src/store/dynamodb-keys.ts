export const EVENT_GSI1PK = "EVENT";
export const ORGANIZATION_GSI3PK = "ORGANIZATION";

/**
 * PK=SK for an arcus student profile item (identity record written at
 * registration). Renamed from the former MEMBER# profile prefix.
 */
export function studentItemKey(studentId: string): string {
  const value = studentId.trim();
  return value.startsWith("STUDENT#") ? value : `STUDENT#${value}`;
}

/**
 * MEMBER# sort key. Still used for two shared-table contracts that apex owns:
 *   - the check-in child of an EVENT partition (PK=EVENT#{id}, SK=MEMBER#{id})
 *   - the apex organization member roster row (PK=ORGANIZATION#{org}, SK=MEMBER#{id})
 * Both must keep the MEMBER# prefix so apex's AggregateEventParticipants and
 * MemberRecords continue to resolve them.
 */
export function memberItemKey(studentId: string): string {
  const value = studentId.trim();
  return value.startsWith("MEMBER#") ? value : `MEMBER#${value}`;
}

/**
 * Extract the raw student number from either a STUDENT# profile key or a
 * MEMBER# sort key.
 */
export function studentIdFromKey(key: string): string {
  const value = key.trim();
  if (value.startsWith("STUDENT#")) {
    return value.slice("STUDENT#".length);
  }
  return value.startsWith("MEMBER#") ? value.slice("MEMBER#".length) : value;
}

export function organizationItemKey(uuid: string): string {
  const value = uuid.trim();
  return value.startsWith("ORGANIZATION#")
    ? value
    : `ORGANIZATION#${value}`;
}

export function organizationIdFromKey(key: string): string {
  const value = key.trim();
  return value.startsWith("ORGANIZATION#")
    ? value.slice("ORGANIZATION#".length)
    : value;
}

export function eventItemKey(uuid: string): string {
  const value = uuid.trim();
  return value.startsWith("EVENT#") ? value : `EVENT#${value}`;
}
