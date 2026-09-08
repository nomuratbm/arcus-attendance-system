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
import {
  parseOrganizationOptions,
  type OrganizationOption,
} from "@/lib/organizations";
import {
  apiErrorMessage,
  readResponseJson,
  requestErrorMessage,
} from "@/lib/request-errors";
import { MAX_STUDENT_NUMBER_LENGTH } from "@/lib/students";

type ErrorModal = {
  title: string;
  description: string;
};

type QrMemberContext = {
  studentId: string;
  organizations: OrganizationOption[];
};

export function RetrieveQrForm() {
  const [formKey, setFormKey] = useState(0);
  const [checking, setChecking] = useState(false);
  const [errorModal, setErrorModal] = useState<ErrorModal | null>(null);
  const [qrMemberContext, setQrMemberContext] =
    useState<QrMemberContext | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const { dataUrl, generating, generate, clear } = useQrCode();
  const busy = checking || generating;

  async function handleFormSubmit(formValues: Record<string, unknown>) {
    const studentNumber = String(formValues.studentNumber ?? "").trim();
    if (!studentNumber) {
      setErrorModal({
        title: "Student number required",
        description: "Enter a student number before retrieving a QR code.",
      });
      return;
    }

    clear();
    setQrMemberContext(null);
    setChecking(true);

    try {
      const response = await fetch(
        `/api/retrieve?student_id=${encodeURIComponent(studentNumber)}`,
      );
      const data = await readResponseJson(response);
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
              : apiErrorMessage(
                  data,
                  "Something went wrong while checking this student number. Please try again.",
                ),
        });
        return;
      }

      const organizations = parseOrganizationOptions(data);

      const url = await generate(studentNumber);
      if (!url) {
        setErrorModal({
          title: "Could not generate QR code",
          description: "The student number is registered, but the QR code could not be created. Please try again.",
        });
        return;
      }

      setQrMemberContext({
        studentId: studentNumber,
        organizations,
      });

      setTimeout(() => {
        qrRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    } catch (error) {
      setErrorModal({
        title: "Could not retrieve QR code",
        description: requestErrorMessage(
          error,
          "Could not retrieve the QR code. Please try again.",
        ),
      });
    } finally {
      setChecking(false);
    }
  }

  function handleClear() {
    clear();
    setQrMemberContext(null);
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
                maxLength={MAX_STUDENT_NUMBER_LENGTH}
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
        {dataUrl && qrMemberContext ? (
          <QrCodePreview
            key={qrMemberContext.studentId}
            dataUrl={dataUrl}
            organizations={qrMemberContext.organizations}
            ref={qrRef}
            studentId={qrMemberContext.studentId}
          />
        ) : null}
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
