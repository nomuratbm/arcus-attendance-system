export type EventWithPk = {
  PK: string;
};

export function mergeEventsByPk<T extends EventWithPk>(
  current: T[],
  incoming: T[],
): T[] {
  const incomingPks = new Set(incoming.map((event) => event.PK));
  const localOnly = current.filter((event) => !incomingPks.has(event.PK));
  return [...localOnly, ...incoming];
}

export function resolveSelectedEventPK<T extends EventWithPk>(
  selectedEventPK: string | null,
  events: T[],
): string | null {
  if (
    selectedEventPK &&
    events.some((event) => event.PK === selectedEventPK)
  ) {
    return selectedEventPK;
  }

  return null;
}

export function readPersistedSelectedEventPK(persisted: unknown): string | null {
  if (typeof persisted !== "object" || persisted === null) {
    return null;
  }

  if (!("selectedEventPK" in persisted)) {
    return null;
  }

  const selectedEventPK = persisted.selectedEventPK;
  return typeof selectedEventPK === "string" && selectedEventPK
    ? selectedEventPK
    : null;
}

export function mergePersistedEventSelection<T extends { selectedEventPK: string | null }>(
  persisted: unknown,
  current: T,
): T {
  return {
    ...current,
    selectedEventPK:
      current.selectedEventPK ?? readPersistedSelectedEventPK(persisted),
  };
}
