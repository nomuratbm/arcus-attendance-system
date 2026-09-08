import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  EVENT_GSI1PK,
  ORGANIZATION_GSI3PK,
  organizationIdFromKey,
  organizationItemKey,
} from "@/store/dynamodb-keys";
import {
  mergeEventsForOrganization,
  mergePersistedEventSelection,
  readPersistedSelectedEventPK,
  readPersistedSelectedOrganizationId,
  resolveSelectedEventPK,
} from "@/store/merge-events";

/**
 * DynamoDB Event item
 *
 * PK: EVENT#(uuid)
 * SK: EVENT#(uuid)
 * GSI1PK: "EVENT"
 * GSI1SK: (timestamp)
 * GSI3PK: "ORGANIZATION"
 * GSI3SK: ORGANIZATION#(uuid)
 * name: string
 * description: string
 */

export interface AttendanceEvent {
  PK: string;
  SK: string;
  GSI1PK: typeof EVENT_GSI1PK;
  GSI1SK: string;
  GSI3PK: typeof ORGANIZATION_GSI3PK;
  GSI3SK: string;
  name: string;
  description: string;
}

interface EventsState {
  events: AttendanceEvent[];
  selectedEventPK: string | null;
  selectedOrganizationId: string | null;
  eventsLoading: boolean;
  eventsError: string | null;
  addEvent: (event: AttendanceEvent) => void;
  removeEvent: (pk: string) => void;
  setEvents: (events: AttendanceEvent[]) => void;
  setEventsLoading: (loading: boolean) => void;
  setEventsError: (error: string | null) => void;
  setSelectedEventPK: (pk: string | null) => void;
  setSelectedOrganizationId: (organizationId: string | null) => void;
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
  const gsi3sk =
    typeof raw.GSI3SK === "string" && raw.GSI3SK
      ? raw.GSI3SK.startsWith("ORGANIZATION#")
        ? raw.GSI3SK
        : organizationItemKey(raw.GSI3SK)
      : "";

  return {
    PK: pk,
    SK: sk || pk,
    GSI1PK: EVENT_GSI1PK,
    GSI1SK: gsi1sk,
    GSI3PK: ORGANIZATION_GSI3PK,
    GSI3SK: gsi3sk,
    name,
    description,
  };
}

export const useEventsStore = create<EventsState>()(
  persist(
    (set) => ({
      events: [],
      selectedEventPK: null,
      selectedOrganizationId: null,
      eventsLoading: false,
      eventsError: null,

      addEvent: (event) => {
        set((state) => ({
          events: [event, ...state.events.filter((item) => item.PK !== event.PK)],
          selectedEventPK: event.PK,
          selectedOrganizationId: event.GSI3SK
            ? organizationIdFromKey(event.GSI3SK)
            : state.selectedOrganizationId,
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
          const organizationKey = state.selectedOrganizationId
            ? organizationItemKey(state.selectedOrganizationId)
            : null;
          const events = mergeEventsForOrganization(
            state.events,
            incoming,
            organizationKey,
          );
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

      setSelectedOrganizationId: (selectedOrganizationId) =>
        set((state) => {
          if (state.selectedOrganizationId === selectedOrganizationId) {
            return state;
          }

          const organizationKey = selectedOrganizationId
            ? organizationItemKey(selectedOrganizationId)
            : null;
          const selectedEventStillValid =
            Boolean(organizationKey) &&
            state.events.some(
              (event) =>
                event.PK === state.selectedEventPK &&
                event.GSI3SK === organizationKey,
            );

          return {
            selectedOrganizationId,
            selectedEventPK: selectedEventStillValid
              ? state.selectedEventPK
              : null,
          };
        }),
    }),
    {
      name: "arcus-events-v2",
      version: 4,
      migrate: (persisted, version) => {
        if (version < 2) {
          return { selectedEventPK: null, selectedOrganizationId: null };
        }

        return {
          selectedEventPK: readPersistedSelectedEventPK(persisted),
          selectedOrganizationId: readPersistedSelectedOrganizationId(persisted),
        };
      },
      merge: mergePersistedEventSelection,
      partialize: (state) => ({
        selectedEventPK: state.selectedEventPK,
        selectedOrganizationId: state.selectedOrganizationId,
      }),
    },
  ),
);
