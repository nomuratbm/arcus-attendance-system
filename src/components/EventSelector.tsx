"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventsStore } from "@/store/useEventsStore";

type EventSelectItem = {
  label: string;
  value: string;
};

export function EventSelector() {
  const events = useEventsStore((state) => state.events);
  const selectedEventPK = useEventsStore((state) => state.selectedEventPK);
  const setSelectedEventPK = useEventsStore((state) => state.setSelectedEventPK);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const eventItems: EventSelectItem[] = events.map((event) => ({
    label: event.name,
    value: event.PK,
  }));
  const selectedItem =
    eventItems.find((item) => item.value === selectedEventPK) ?? null;
  const hasEvents = hasHydrated && eventItems.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active event</CardTitle>
        <CardDescription>
          Choose the event this scan session is recording attendance for.
        </CardDescription>
      </CardHeader>
      <CardPanel>
        <Field className="w-full">
          <FieldLabel>Event</FieldLabel>
          <Select
            disabled={!hasEvents}
            isItemEqualToValue={(itemValue, value) =>
              itemValue.value === value.value
            }
            items={eventItems}
            onValueChange={(value) => {
              setSelectedEventPK(value?.value ?? null);
            }}
            value={selectedItem}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={hasEvents ? "Select an event" : "No events yet"}
              />
            </SelectTrigger>
            <SelectPopup alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectGroupLabel>Events</SelectGroupLabel>
                {eventItems.map((item) => (
                  <SelectItem key={item.value} value={item}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectPopup>
          </Select>
          <FieldDescription>
            {hasEvents
              ? "Attendance scans will be recorded for this event."
              : "Use Add Event in the header to create an event first."}
          </FieldDescription>
        </Field>
      </CardPanel>
    </Card>
  );
}
