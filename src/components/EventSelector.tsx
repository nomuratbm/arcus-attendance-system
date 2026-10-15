"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldItem,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAttendanceStore } from "@/store/useAttendanceStore";
import { useEventsStore } from "@/store/useEventsStore";

type EventSelectItem = {
  label: string;
  value: string;
};

export function EventSelector() {
  const events = useEventsStore((state) => state.events);
  const selectedEventPK = useEventsStore((state) => state.selectedEventPK);
  const setSelectedEventPK = useEventsStore((state) => state.setSelectedEventPK);
  const eventsLoading = useEventsStore((state) => state.eventsLoading);
  const eventsError = useEventsStore((state) => state.eventsError);
  const attendanceLoading = useAttendanceStore(
    (state) => state.attendanceLoading,
  );
  const scanTimestampMode = useAttendanceStore(
    (state) => state.scanTimestampMode,
  );
  const setScanTimestampMode = useAttendanceStore(
    (state) => state.setScanTimestampMode,
  );
  const membersOnlyMode = useAttendanceStore(
    (state) => state.membersOnlyMode,
  );
  const setMembersOnlyMode = useAttendanceStore(
    (state) => state.setMembersOnlyMode,
  );

  // The events API already scopes this list to the signed-in account's
  // organization. Accounts without that claim receive every open event.
  const eventItems: EventSelectItem[] = events.map((event) => ({
    label: event.name,
    value: event.PK,
  }));
  const selectedItem =
    eventItems.find((item) => item.value === selectedEventPK) ?? null;
  const hasEvents = eventItems.length > 0;
  const selectPlaceholder = eventsLoading
    ? "Loading events..."
    : hasEvents
      ? "Select an event"
      : "No events open today";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active event</CardTitle>
        <CardDescription>
          Choose the event this scan session is recording attendance for. Only
          approved events happening today for your signed-in organization are
          listed.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        <Field className="w-full">
          <FieldLabel>Event</FieldLabel>
          {eventsLoading ? (
            <Skeleton
              aria-label="Loading events"
              className="h-9 w-full"
              role="status"
            />
          ) : (
            <Select
              disabled={!hasEvents || attendanceLoading}
              isItemEqualToValue={(itemValue, value) =>
                itemValue.value === value?.value
              }
              items={eventItems}
              onValueChange={(value) => {
                setSelectedEventPK(value?.value ?? null);
              }}
              value={selectedItem}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectPlaceholder} />
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
          )}
          <FieldDescription>
            {eventsError ? (
              <span role="alert">{eventsError}</span>
            ) : hasEvents ? (
              "Attendance scans will be recorded for this event."
            ) : eventsLoading ? (
              "Loading events from mapua-apex."
            ) : (
              "No approved event is open for your organization today."
            )}
          </FieldDescription>
        </Field>
        <Field className="w-full">
          <FieldLabel>Scan timestamp</FieldLabel>
          <FieldItem className="items-center gap-3">
            <span className="text-sm">Entered at</span>
            <Switch
              aria-label="Toggle between Entered at and Left at"
              checked={scanTimestampMode === "leftAt"}
              onCheckedChange={(checked) => {
                setScanTimestampMode(checked ? "leftAt" : "enteredAt");
              }}
            />
            <span className="text-sm">Left at</span>
          </FieldItem>
          <FieldDescription>
            {scanTimestampMode === "leftAt"
              ? "Scanning a student QR updates their left-at time. Later scans overwrite the previous time."
              : "Scanning a student QR records their entered-at check-in for this event."}
          </FieldDescription>
        </Field>
        <Field className="w-full">
          <FieldLabel>Access restriction</FieldLabel>
          <FieldItem className="items-center gap-3">
            <span className="text-sm">Allow members only</span>
            <Switch
              aria-label="Allow members only"
              checked={membersOnlyMode}
              onCheckedChange={(checked) => {
                setMembersOnlyMode(checked);
              }}
            />
          </FieldItem>
          <FieldDescription>
            {membersOnlyMode
              ? "Only students on your organization's member roster can check in."
              : "Any registered student can check in to this event."}
          </FieldDescription>
        </Field>
      </CardPanel>
    </Card>
  );
}