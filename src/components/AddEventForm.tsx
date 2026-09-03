"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { ToastProvider, toastManager } from "@/components/ui/toast";
import {
  type AttendanceEvent,
  useEventsStore,
} from "@/store/useEventsStore";

function eventFromResponse(value: unknown): AttendanceEvent | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const event = value as Record<string, unknown>;
  if (
    typeof event.PK !== "string" ||
    typeof event.SK !== "string" ||
    event.GSI1PK !== "EVENT" ||
    typeof event.GSI1SK !== "string" ||
    typeof event.name !== "string" ||
    typeof event.description !== "string"
  ) {
    return null;
  }

  return {
    PK: event.PK,
    SK: event.SK,
    GSI1PK: "EVENT",
    GSI1SK: event.GSI1SK,
    name: event.name,
    description: event.description,
  };
}

export function AddEventForm() {
  const [formKey, setFormKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const addEvent = useEventsStore((state) => state.addEvent);

  async function handleFormSubmit(formValues: Record<string, unknown>) {
    const name = String(formValues.name ?? "").trim();
    const description = String(formValues.description ?? "").trim();

    setSubmitting(true);
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data: unknown = await response.json();
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
        const error =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "An unexpected error occurred.";
        toastManager.add({
          type: "error",
          title: "Failed to create event",
          description: error,
        });
      }
    } catch {
      toastManager.add({
        type: "error",
        title: "Network error",
        description: "Could not reach the server. Please try again.",
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
