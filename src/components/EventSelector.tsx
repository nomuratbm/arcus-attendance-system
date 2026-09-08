"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
import { Switch } from "@/components/ui/switch";
import { ToastProvider, toastManager } from "@/components/ui/toast";
import {
  apiErrorMessage,
  readResponseJson,
  requestErrorMessage,
} from "@/lib/request-errors";
import { organizationItemKey } from "@/store/dynamodb-keys";
import { useAttendanceStore } from "@/store/useAttendanceStore";
import { useEventsStore } from "@/store/useEventsStore";
import { useOrganizationsStore } from "@/store/useOrganizationsStore";

type EventSelectItem = {
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
  const removeEvent = useEventsStore((state) => state.removeEvent);
  const eventsLoading = useEventsStore((state) => state.eventsLoading);
  const eventsError = useEventsStore((state) => state.eventsError);
  const scanTimestampMode = useAttendanceStore(
    (state) => state.scanTimestampMode,
  );
  const setScanTimestampMode = useAttendanceStore(
    (state) => state.setScanTimestampMode,
  );
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const organizations = useOrganizationsStore((state) => state.organizations);
  const organizationsError = useOrganizationsStore(
    (state) => state.organizationsError,
  );
  const organizationsLoading = useOrganizationsStore(
    (state) => state.organizationsLoading,
  );
  const loadOrganizations = useOrganizationsStore(
    (state) => state.loadOrganizations,
  );
  const selectedOrganization =
    organizations.find(
      (organization) => organization.value === selectedOrganizationId,
    ) ?? null;

  useEffect(() => {
    setSelectedEventPK(null);
    setSelectedOrganizationId(null);
    void loadOrganizations();
  }, [
    loadOrganizations,
    setSelectedEventPK,
    setSelectedOrganizationId,
  ]);

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
  const selectedEvent = organizationEvents.find(
    (event) => event.PK === selectedEventPK,
  );
  const hasEvents = eventItems.length > 0;
  const canDelete = Boolean(selectedEvent);
  const selectPlaceholder =
    !selectedOrganizationId
      ? "Select an organization first"
      : !hasEvents && eventsLoading
        ? "Loading events..."
        : hasEvents
          ? "Select an event"
          : "No events for this organization";

  async function handleConfirmDelete() {
    if (!selectedEvent) {
      return;
    }

    const eventId = selectedEvent.PK.replace(/^EVENT#/, "");
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
        method: "DELETE",
      });
      const data = await readResponseJson(response);

      if (!response.ok) {
        toastManager.add({
          type: "error",
          title: "Could not delete event",
          description: apiErrorMessage(data, "Failed to delete event."),
        });
        return;
      }

      removeEvent(selectedEvent.PK);
      setIsDeleteOpen(false);
      toastManager.add({
        type: "success",
        title: "Event deleted",
        description: selectedEvent.name,
      });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Could not delete event",
        description: requestErrorMessage(
          error,
          "Could not delete the event. Please try again.",
        ),
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <ToastProvider position="bottom-right">
      <Card>
        <CardHeader>
          <CardTitle>Active event</CardTitle>
          <CardDescription>
            Choose the organization and event this scan session is recording
            attendance for.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-4">
          <Field className="w-full">
            <FieldLabel>Organization</FieldLabel>
            <Select
              disabled={organizationsLoading || Boolean(organizationsError)}
              isItemEqualToValue={(item, value) =>
                item.value === value?.value
              }
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
            <FieldDescription>
              {organizationsError ? (
                <span className="flex flex-wrap items-center gap-2" role="alert">
                  <span>{organizationsError}</span>
                  <Button
                    disabled={organizationsLoading}
                    onClick={() => void loadOrganizations(true)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Retry
                  </Button>
                </span>
              ) : (
                "Events are listed only for the selected organization."
              )}
            </FieldDescription>
          </Field>
          <Field className="w-full">
            <FieldLabel>Event</FieldLabel>
            <ContextMenu>
              <ContextMenuTrigger className="block w-full" render={<div />}>
                <Select
                  disabled={!hasEvents}
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
              </ContextMenuTrigger>
              <ContextMenuPopup>
                <ContextMenuGroup>
                  <ContextMenuItem
                    disabled={!canDelete}
                    onClick={() => setIsDeleteOpen(true)}
                    variant="destructive"
                  >
                    <Trash2 />
                    Delete event
                  </ContextMenuItem>
                </ContextMenuGroup>
              </ContextMenuPopup>
            </ContextMenu>
            <FieldDescription>
              {eventsError
                ? eventsError
                : hasEvents
                  ? "Attendance scans will be recorded for this event. Right-click to delete it."
                  : eventsLoading
                    ? "Loading events from the registry."
                    : selectedOrganizationId
                      ? "Use Add Event in the header to create an event for this organization."
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

      <AlertDialog onOpenChange={setIsDeleteOpen} open={isDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes{" "}
              <strong className="text-foreground">
                {selectedEvent?.name ?? "this event"}
              </strong>{" "}
              from the active event list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button size="sm" variant="outline" />}>
              Cancel
            </AlertDialogClose>
            <Button
              loading={isDeleting}
              onClick={handleConfirmDelete}
              size="sm"
              variant="destructive"
            >
              Delete event
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ToastProvider>
  );
}
