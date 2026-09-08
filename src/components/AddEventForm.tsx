"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToastProvider, toastManager } from "@/components/ui/toast";
import {
  apiErrorMessage,
  readResponseJson,
  requestErrorMessage,
} from "@/lib/request-errors";
import {
  parseAttendanceEvent,
  type AttendanceEvent,
  useEventsStore,
} from "@/store/useEventsStore";
import { useOrganizationsStore } from "@/store/useOrganizationsStore";

function eventFromResponse(value: unknown): AttendanceEvent | null {
  return parseAttendanceEvent(value);
}

export function AddEventForm() {
  const [formKey, setFormKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const addEvent = useEventsStore((state) => state.addEvent);
  const selectedOrganizationId = useEventsStore(
    (state) => state.selectedOrganizationId,
  );
  const setSelectedOrganizationId = useEventsStore(
    (state) => state.setSelectedOrganizationId,
  );
  const organizations = useOrganizationsStore((state) => state.organizations);
  const organizationsError = useOrganizationsStore(
    (state) => state.organizationsError,
  );
  const organizationsLoading = useOrganizationsStore(
    (state) => state.organizationsLoading,
  );
  const organizationsLoaded = useOrganizationsStore(
    (state) => state.organizationsLoaded,
  );
  const loadOrganizations = useOrganizationsStore(
    (state) => state.loadOrganizations,
  );
  const selectedOrganization =
    organizations.find(
      (organization) => organization.value === selectedOrganizationId,
    ) ?? null;

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    if (
      organizationsLoaded &&
      !organizationsLoading &&
      !selectedOrganization
    ) {
      setSelectedOrganizationId(organizations[0]?.value ?? null);
    }
  }, [
    organizations,
    organizationsLoaded,
    organizationsLoading,
    selectedOrganization,
    setSelectedOrganizationId,
  ]);

  async function handleFormSubmit(formValues: Record<string, unknown>) {
    const name = String(formValues.name ?? "").trim();
    const description = String(formValues.description ?? "").trim();
    const organization = selectedOrganizationId ?? "";

    if (!organization) {
      toastManager.add({
        type: "error",
        title: "Select an organization",
        description: "Choose an organization before creating the event.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, organization }),
      });
      const data = await readResponseJson(response);
      const event =
        typeof data === "object" && data !== null && "event" in data
          ? eventFromResponse(data.event)
          : null;

      if (response.ok && event) {
        addEvent(event);
        toastManager.add({
          type: "success",
          title: "Event added",
          description: `${event.name} · ${event.PK}`,
        });
        setFormKey((current) => current + 1);
      } else {
        toastManager.add({
          type: "error",
          title: "Failed to create event",
          description: apiErrorMessage(
            data,
            "An unexpected error occurred. Please try again.",
          ),
        });
      }
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Failed to create event",
        description: requestErrorMessage(
          error,
          "Could not create the event. Please try again.",
        ),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ToastProvider position="bottom-right">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Event details</CardTitle>
          <CardDescription>
            Create an event so scanner check-ins can be tied to a session.
          </CardDescription>
        </CardHeader>
        <Form
          key={formKey}
          className="contents"
          onFormSubmit={handleFormSubmit}
        >
          <CardPanel className="flex flex-col gap-4">
            <Field className="w-full" name="organization">
              <FieldLabel>Organization</FieldLabel>
              <Select
                disabled={organizationsLoading || Boolean(organizationsError)}
                isItemEqualToValue={(item, value) =>
                  item.value === value?.value
                }
                items={organizations}
                onValueChange={(value) =>
                  setSelectedOrganizationId(value?.value ?? null)
                }
                required
                value={selectedOrganization}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an organization" />
                </SelectTrigger>
                <SelectPopup alignItemWithTrigger={false}>
                  <SelectGroup>
                    {organizations.map((organization) => (
                      <SelectItem
                        key={organization.value}
                        value={organization}
                      >
                        {organization.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectPopup>
              </Select>
              {organizationsError ? (
                <div
                  className="flex flex-wrap items-center gap-2 text-destructive-foreground text-xs"
                  role="alert"
                >
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
                </div>
              ) : null}
              <FieldError>Please select an organization.</FieldError>
            </Field>

            <Field className="w-full" name="name">
              <FieldLabel>Name</FieldLabel>
              <Input
                autoComplete="off"
                name="name"
                placeholder="Example: AWS Arcus Kickoff"
                required
                type="text"
              />
              <FieldError>Please enter an event name.</FieldError>
            </Field>

            <Field className="w-full" name="description">
              <FieldLabel>Description</FieldLabel>
              <Textarea
                name="description"
                placeholder="Example: Opening ceremony and member check-in"
                required
              />
              <FieldError>Please enter an event description.</FieldError>
            </Field>
          </CardPanel>
          <CardFooter className="justify-end gap-2">
            <Button disabled={submitting} type="reset" variant="ghost">
              Clear
            </Button>
            <Button loading={submitting} type="submit">
              Add event
            </Button>
          </CardFooter>
        </Form>
      </Card>
    </ToastProvider>
  );
}
