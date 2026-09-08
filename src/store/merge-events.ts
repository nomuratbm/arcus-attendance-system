export type EventWithPk = {
  PK: string;
};

export type EventWithOrganization = EventWithPk & {
  GSI3SK?: string;
};

export function mergeEventsByPk<T extends EventWithPk>(
  current: T[],
  incoming: T[],
): T[] {
  const incomingPks = new Set(incoming.map((event) => event.PK));
  const localOnly = current.filter((event) => !incomingPks.has(event.PK));
  return [...localOnly, ...incoming];
}

export function mergeEventsForOrganization<T extends EventWithOrganization>(
  current: T[],
  incoming: T[],
  organizationKey: string | null,
): T[] {
  const scopedCurrent = organizationKey
    ? current.filter((event) => event.GSI3SK === organizationKey)
    : current;

  return mergeEventsByPk(scopedCurrent, incoming);
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

export function readPersistedSelectedOrganizationId(
  persisted: unknown,
): string | null {
  if (typeof persisted !== "object" || persisted === null) {
    return null;
  }

  if (!("selectedOrganizationId" in persisted)) {
    return null;
  }

  const selectedOrganizationId = persisted.selectedOrganizationId;
  return typeof selectedOrganizationId === "string" && selectedOrganizationId
    ? selectedOrganizationId
    : null;
}

export function mergePersistedEventSelection<
  T extends {
    selectedEventPK: string | null;
    selectedOrganizationId?: string | null;
  },
>(persisted: unknown, current: T): T {
  return {
    ...current,
    selectedEventPK:
      current.selectedEventPK ?? readPersistedSelectedEventPK(persisted),
    selectedOrganizationId:
      readPersistedSelectedOrganizationId(persisted) ??
      current.selectedOrganizationId,
  };
}
