import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * DynamoDB Event item
 *
 * PK: EVENT#(timestamp)
 * SK: EVENT#(timestamp)
 * Name: string
 * Description: string
 */

export interface AttendanceEvent {
  PK: string;
  SK: string;
  Name: string;
  Description: string;
}

type EventDetails = {
  Name: string;
  Description: string;
};

interface EventsState {
  events: AttendanceEvent[];
  selectedEventPK: string | null;
  addEvent: (details: EventDetails) => AttendanceEvent;
  setSelectedEventPK: (pk: string | null) => void;
}

function createEventKeys(timestamp: number) {
  const id = `EVENT#${timestamp}`;
  return { PK: id, SK: id };
}

export const useEventsStore = create<EventsState>()(
  persist(
    (set) => ({
      events: [],
      selectedEventPK: null,

      addEvent: ({ Name, Description }) => {
        const keys = createEventKeys(Date.now());
        const event: AttendanceEvent = {
          ...keys,
          Name,
          Description,
        };

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
      partialize: (state) => ({
        events: state.events,
        selectedEventPK: state.selectedEventPK,
      }),
    },
  ),
);
