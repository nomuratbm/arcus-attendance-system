import { create } from "zustand";
import { persist } from "zustand/middleware";
import { EVENT_GSI1PK } from "@/store/dynamodb-keys";
import {
  mergeEventsByPk,
  mergePersistedEventSelection,
  readPersistedSelectedEventPK,
  resolveSelectedEventPK,
} from "@/store/merge-events";

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

interface EventsState {
  events: AttendanceEvent[];
  selectedEventPK: string | null;
  eventsLoading: boolean;
  eventsError: string | null;
  addEvent: (event: AttendanceEvent) => void;
  removeEvent: (pk: string) => void;
  setEvents: (events: AttendanceEvent[]) => void;
  setEventsLoading: (loading: boolean) => void;
  setEventsError: (error: string | null) => void;
  setSelectedEventPK: (pk: string | null) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseAttendanceEvent(raw: unknown): AttendanceEvent | null {
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

export const useEventsStore = create<EventsState>()(
  persist(
    (set) => ({
      events: [],
      selectedEventPK: null,
      eventsLoading: false,
      eventsError: null,

      addEvent: (event) => {
        set((state) => ({
          events: [event, ...state.events.filter((item) => item.PK !== event.PK)],
          selectedEventPK: event.PK,
        }));
      },

      removeEvent: (pk) => {
        set((state) => {
          const events = state.events.filter((event) => event.PK !== pk);
          const selectedEventPK =
            state.selectedEventPK === pk
              ? (events[0]?.PK ?? null)
              : state.selectedEventPK;

          return { events, selectedEventPK };
        });
      },

      setEvents: (incoming) => {
        set((state) => {
          const events = mergeEventsByPk(state.events, incoming);
          return {
            events,
            eventsError: null,
            selectedEventPK: resolveSelectedEventPK(
              state.selectedEventPK,
              events,
            ),
          };
        });
      },

      setEventsLoading: (eventsLoading) => set({ eventsLoading }),

      setEventsError: (eventsError) => set({ eventsError }),

      setSelectedEventPK: (selectedEventPK) => set({ selectedEventPK }),
    }),
    {
      name: "arcus-events-v2",
      version: 3,
      migrate: (persisted, version) => {
        if (version < 2) {
          return { selectedEventPK: null };
        }

        return { selectedEventPK: readPersistedSelectedEventPK(persisted) };
      },
      merge: mergePersistedEventSelection,
      partialize: (state) => ({
        selectedEventPK: state.selectedEventPK,
      }),
    },
  ),
);
