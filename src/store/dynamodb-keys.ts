export const EVENT_GSI1PK = "EVENT";

export function memberItemKey(studentId: string): string {
  const value = studentId.trim();
  return value.startsWith("MEMBER#") ? value : `MEMBER#${value}`;
}

export function studentIdFromMemberKey(key: string): string {
  const value = key.trim();
  return value.startsWith("MEMBER#") ? value.slice("MEMBER#".length) : value;
}

export function eventItemKey(uuid: string): string {
  const value = uuid.trim();
  return value.startsWith("EVENT#") ? value : `EVENT#${value}`;
}
