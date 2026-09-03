"use client";

import { useRef, useState } from "react";
import { QrCodePreview } from "@/components/QrCodePreview";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useQrCode } from "@/hooks/use-qr-code";

type ErrorModal = {
  title: string;
  description: string;
};

export function RetrieveQrForm() {
  const [formKey, setFormKey] = useState(0);
  const [checking, setChecking] = useState(false);
  const [errorModal, setErrorModal] = useState<ErrorModal | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const { dataUrl, generating, generate, clear } = useQrCode();
  const busy = checking || generating;

  async function handleFormSubmit(formValues: Record<string, unknown>) {
    const studentNumber = String(formValues.studentNumber ?? "").trim();
    if (!studentNumber) {
      return;
    }

    clear();
    setChecking(true);

    try {
      const response = await fetch(
        `/api/retrieve?student_id=${encodeURIComponent(studentNumber)}`,
      );
      const data: unknown = await response.json();
      const registered =
        typeof data === "object" &&
        data !== null &&
        "registered" in data &&
        data.registered === true;

      if (!response.ok || !registered) {
        setErrorModal({
          title: response.status === 404 ? "Student not registered" : "Could not retrieve QR code",
          description:
            response.status === 404
              ? "This student number is not registered. Go to Register first to create a QR code."
              : "Something went wrong while checking this student number. Please try again.",
        });
        return;
      }

      const url = await generate(studentNumber);
      if (!url) {
        setErrorModal({
          title: "Could not generate QR code",
          description: "The student number is registered, but the QR code could not be created. Please try again.",
        });
        return;
      }

      setTimeout(() => {
        qrRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    } catch {
      setErrorModal({
        title: "Could not retrieve QR code",
        description: "Could not reach the server. Please try again.",
      });
    } finally {
      setChecking(false);
    }
  }

  function handleClear() {
    clear();
    setFormKey((current) => current + 1);
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Retrieve QR code</CardTitle>
          <CardDescription>
            Enter your student number to generate the attendance QR code.
          </CardDescription>
        </CardHeader>
        <Form
          className="contents"
          key={formKey}
          onFormSubmit={handleFormSubmit}
        >
          <CardPanel className="flex flex-col gap-4">
            <Field className="w-full" name="studentNumber">
              <FieldLabel>Student Number</FieldLabel>
              <Input
                autoComplete="off"
                inputMode="numeric"
                name="studentNumber"
                placeholder="Example: 2024105858"
                required
                type="text"
              />
              <FieldError>Please enter a student number.</FieldError>
            </Field>
          </CardPanel>
          <CardFooter className="justify-end gap-2">
            <Button onClick={handleClear} type="reset" variant="ghost">
              Clear
            </Button>
            <Button disabled={busy} type="submit">
              {checking
                ? "Checking..."
                : generating
                  ? "Generating..."
                  : "Generate QR"}
            </Button>
          </CardFooter>
        </Form>
        {dataUrl ? <QrCodePreview dataUrl={dataUrl} ref={qrRef} /> : null}
      </Card>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setErrorModal(null);
          }
        }}
        open={errorModal !== null}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{errorModal?.title ?? "Error"}</DialogTitle>
            <DialogDescription>
              {errorModal?.description ?? ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" />}>OK</DialogClose>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}
