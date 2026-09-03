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
import { ToastProvider, toastManager } from "@/components/ui/toast";
import { useEventsStore } from "@/store/useEventsStore";

type EventSelectItem = {
  label: string;
  value: string;
};

export function EventSelector() {
  const events = useEventsStore((state) => state.events);
  const selectedEventPK = useEventsStore((state) => state.selectedEventPK);
  const setSelectedEventPK = useEventsStore((state) => state.setSelectedEventPK);
  const removeEvent = useEventsStore((state) => state.removeEvent);
  const eventsLoading = useEventsStore((state) => state.eventsLoading);
  const eventsError = useEventsStore((state) => state.eventsError);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const eventItems: EventSelectItem[] = events.map((event) => ({
    label: event.name,
    value: event.PK,
  }));
  const selectedItem =
    eventItems.find((item) => item.value === selectedEventPK) ?? null;
  const selectedEvent = events.find((event) => event.PK === selectedEventPK);
  const hasEvents = hasHydrated && eventItems.length > 0;
  const canDelete = Boolean(selectedEvent);
  const selectPlaceholder = eventsLoading
    ? "Loading events..."
    : hasEvents
      ? "Select an event"
      : "No events yet";

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
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const error =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Failed to delete event.";
        toastManager.add({
          type: "error",
          title: "Could not delete event",
          description: error,
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
    } catch {
      toastManager.add({
        type: "error",
        title: "Network error",
        description: "Could not reach the server. Please try again.",
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
            Choose the event this scan session is recording attendance for.
          </CardDescription>
        </CardHeader>
        <CardPanel>
          <Field className="w-full">
            <FieldLabel>Event</FieldLabel>
            <ContextMenu>
              <ContextMenuTrigger className="block w-full" render={<div />}>
                <Select
                  disabled={!hasEvents || eventsLoading}
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
                : eventsLoading
                  ? "Loading events from the registry."
                  : hasEvents
                    ? "Attendance scans will be recorded for this event. Right-click to delete it."
                    : "Use Add Event in the header to create an event first."}
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
