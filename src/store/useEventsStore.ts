import { create } from "zustand";
import { persist } from "zustand/middleware";
import { EVENT_GSI1PK, eventItemKey } from "@/store/dynamodb-keys";

/**
 * DynamoDB Event item
 *
 * PK: EVENT#(uuid)
 * SK: EVENT#(uuid)
 * GSI1PK: "EVENT"
 * GSI1SK: (timestamp)
 * name: string
 * description: string
 */

export interface AttendanceEvent {
  PK: string;
  SK: string;
  GSI1PK: typeof EVENT_GSI1PK;
  GSI1SK: string;
  name: string;
  description: string;
}

type EventDetails = {
  name: string;
  description: string;
};

interface EventsState {
  events: AttendanceEvent[];
  selectedEventPK: string | null;
  addEvent: (details: EventDetails) => AttendanceEvent;
  setSelectedEventPK: (pk: string | null) => void;
}

type PersistedEventsState = {
  events?: unknown;
  selectedEventPK?: unknown;
};

function createEventItem({ name, description }: EventDetails): AttendanceEvent {
  const id = eventItemKey(crypto.randomUUID());
  return {
    PK: id,
    SK: id,
    GSI1PK: EVENT_GSI1PK,
    GSI1SK: String(Date.now()),
    name,
    description,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function migrateEvent(raw: unknown): AttendanceEvent | null {
  if (!isRecord(raw)) {
    return null;
  }

  const pk = typeof raw.PK === "string" ? raw.PK : "";
  const sk = typeof raw.SK === "string" ? raw.SK : pk;
  const name =
    typeof raw.name === "string"
      ? raw.name
      : typeof raw.Name === "string"
        ? raw.Name
        : "";
  const description =
    typeof raw.description === "string"
      ? raw.description
      : typeof raw.Description === "string"
        ? raw.Description
        : "";

  if (!pk || !name) {
    return null;
  }

  const timestampFromLegacyKey = pk.startsWith("EVENT#")
    ? Number(pk.slice("EVENT#".length))
    : Number.NaN;
  const gsi1sk =
    typeof raw.GSI1SK === "string"
      ? raw.GSI1SK
      : typeof raw.GSI1SK === "number"
        ? String(raw.GSI1SK)
        : Number.isFinite(timestampFromLegacyKey)
          ? String(timestampFromLegacyKey)
          : String(Date.now());

  return {
    PK: pk,
    SK: sk || pk,
    GSI1PK: EVENT_GSI1PK,
    GSI1SK: gsi1sk,
    name,
    description,
  };
}

function migratePersistedEvents(
  persisted: unknown,
): Pick<EventsState, "events" | "selectedEventPK"> {
  if (!isRecord(persisted)) {
    return { events: [], selectedEventPK: null };
  }

  const events = Array.isArray(persisted.events)
    ? persisted.events
        .map(migrateEvent)
        .filter((event): event is AttendanceEvent => event !== null)
    : [];
  const selectedEventPK =
    typeof persisted.selectedEventPK === "string" &&
    events.some((event) => event.PK === persisted.selectedEventPK)
      ? persisted.selectedEventPK
      : (events[0]?.PK ?? null);

  return { events, selectedEventPK };
}

export const useEventsStore = create<EventsState>()(
  persist(
    (set) => ({
      events: [],
      selectedEventPK: null,

      addEvent: ({ name, description }) => {
        const event = createEventItem({ name, description });

        set((state) => ({
          events: [event, ...state.events],
          selectedEventPK: event.PK,
        }));

        return event;
      },

      setSelectedEventPK: (selectedEventPK) => set({ selectedEventPK }),
    }),
    {
      name: "arcus-events",
      version: 1,
      migrate: (persisted) =>
        migratePersistedEvents(persisted as PersistedEventsState),
      merge: (persisted, current) => ({
        ...current,
        ...migratePersistedEvents(persisted),
      }),
      partialize: (state) => ({
        events: state.events,
        selectedEventPK: state.selectedEventPK,
      }),
    },
  ),
);
