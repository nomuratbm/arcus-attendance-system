export const EVENT_GSI1PK = "EVENT";

export function memberItemKey(uuid: string): string {
  const value = uuid.trim();
  return value.startsWith("MEMBER#") ? value : `MEMBER#${value}`;
}

export function eventItemKey(uuid: string): string {
  const value = uuid.trim();
  return value.startsWith("EVENT#") ? value : `EVENT#${value}`;
}
