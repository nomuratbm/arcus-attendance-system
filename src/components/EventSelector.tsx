"use client";

import { useEffect, useMemo } from "react";
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
import {
  organizationIdFromKey,
  organizationItemKey,
} from "@/store/dynamodb-keys";
import { useAttendanceStore } from "@/store/useAttendanceStore";
import { useEventsStore } from "@/store/useEventsStore";

type EventSelectItem = {
  label: string;
  value: string;
};

type OrganizationSelectItem = {
  label: string;
  value: string;
};

export function EventSelector() {
  const events = useEventsStore((state) => state.events);
  const selectedEventPK = useEventsStore((state) => state.selectedEventPK);
  const selectedOrganizationId = useEventsStore(
    (state) => state.selectedOrganizationId,
  );
  const setSelectedEventPK = useEventsStore((state) => state.setSelectedEventPK);
  const setSelectedOrganizationId = useEventsStore(
    (state) => state.setSelectedOrganizationId,
  );
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

  // Organizations are derived from the loaded mapua-apex events (each carries
  // its own organization_id / organization_name), so an org_submitter sees only
  // their org and an admin sees every org that has an open event today.
  const organizations = useMemo<OrganizationSelectItem[]>(() => {
    const seen = new Map<string, string>();
    for (const event of events) {
      const organizationId = organizationIdFromKey(event.GSI3SK);
      if (!organizationId || seen.has(organizationId)) {
        continue;
      }
      seen.set(organizationId, event.organizationName || organizationId);
    }
    return Array.from(seen, ([value, label]) => ({ value, label })).sort(
      (left, right) => left.label.localeCompare(right.label),
    );
  }, [events]);

  const selectedOrganization =
    organizations.find(
      (organization) => organization.value === selectedOrganizationId,
    ) ?? null;

  // Auto-select when there is exactly one org (the common org_submitter case).
  useEffect(() => {
    if (!selectedOrganizationId && organizations.length === 1) {
      setSelectedOrganizationId(organizations[0].value);
    }
  }, [organizations, selectedOrganizationId, setSelectedOrganizationId]);

  const organizationKey = selectedOrganizationId
    ? organizationItemKey(selectedOrganizationId)
    : null;
  const organizationEvents = organizationKey
    ? events.filter((event) => event.GSI3SK === organizationKey)
    : [];
  const eventItems: EventSelectItem[] = organizationEvents.map((event) => ({
    label: event.name,
    value: event.PK,
  }));
  const selectedItem =
    eventItems.find((item) => item.value === selectedEventPK) ?? null;
  const hasEvents = eventItems.length > 0;
  const selectPlaceholder =
    !selectedOrganizationId
      ? "Select an organization first"
      : !hasEvents && eventsLoading
        ? "Loading events..."
        : hasEvents
          ? "Select an event"
          : "No events for this organization";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active event</CardTitle>
        <CardDescription>
          Choose the organization and event this scan session is recording
          attendance for. Only approved events happening today are listed.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        <Field className="w-full">
          <FieldLabel>Organization</FieldLabel>
          {eventsLoading && organizations.length === 0 ? (
            <Skeleton
              aria-label="Loading organizations"
              className="h-9 w-full"
              role="status"
            />
          ) : (
            <Select
              disabled={
                eventsLoading ||
                attendanceLoading ||
                organizations.length === 0
              }
              isItemEqualToValue={(item, value) => item.value === value?.value}
              items={organizations}
              onValueChange={(value) => {
                setSelectedOrganizationId(value?.value ?? null);
              }}
              value={selectedOrganization}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an organization" />
              </SelectTrigger>
              <SelectPopup alignItemWithTrigger={false}>
                <SelectGroup>
                  <SelectGroupLabel>Organizations</SelectGroupLabel>
                  {organizations.map((organization) => (
                    <SelectItem key={organization.value} value={organization}>
                      {organization.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectPopup>
            </Select>
          )}
          <FieldDescription>
            {eventsError ? (
              <span role="alert">{eventsError}</span>
            ) : (
              "Organizations are listed from approved events open today."
            )}
          </FieldDescription>
        </Field>
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
            {eventsError
              ? eventsError
              : hasEvents
                ? "Attendance scans will be recorded for this event."
                : eventsLoading
                  ? "Loading events from mapua-apex."
                  : selectedOrganizationId
                    ? "No approved event is open for this organization today."
                    : "Select an organization to load its events."}
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
      </CardPanel>
    </Card>
  );
}