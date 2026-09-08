export const EVENT_GSI1PK = "EVENT";
export const ORGANIZATION_GSI3PK = "ORGANIZATION";

export function memberItemKey(studentId: string): string {
  const value = studentId.trim();
  return value.startsWith("MEMBER#") ? value : `MEMBER#${value}`;
}

export function studentIdFromMemberKey(key: string): string {
  const value = key.trim();
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
