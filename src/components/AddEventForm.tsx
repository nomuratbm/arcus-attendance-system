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
import { useEventsStore } from "@/store/useEventsStore";

export function AddEventForm() {
  const [formKey, setFormKey] = useState(0);
  const addEvent = useEventsStore((state) => state.addEvent);

  function handleFormSubmit(formValues: Record<string, unknown>) {
    const Name = String(formValues.Name ?? "").trim();
    const Description = String(formValues.Description ?? "").trim();

    const event = addEvent({ Name, Description });

    toastManager.add({
      type: "success",
      title: "Event added",
      description: `${event.Name} · ${event.PK}`,
    });
    setFormKey((current) => current + 1);
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
            <Field className="w-full" name="Name">
              <FieldLabel>Name</FieldLabel>
              <Input
                autoComplete="off"
                name="Name"
                placeholder="Example: AWS Arcus Kickoff"
                required
                type="text"
              />
              <FieldError>Please enter an event name.</FieldError>
            </Field>

            <Field className="w-full" name="Description">
              <FieldLabel>Description</FieldLabel>
              <Textarea
                name="Description"
                placeholder="Example: Opening ceremony and member check-in"
                required
              />
              <FieldError>Please enter an event description.</FieldError>
            </Field>
          </CardPanel>
          <CardFooter className="justify-end gap-2">
            <Button type="reset" variant="ghost">
              Clear
            </Button>
            <Button type="submit">Add event</Button>
          </CardFooter>
        </Form>
      </Card>
    </ToastProvider>
  );
}
