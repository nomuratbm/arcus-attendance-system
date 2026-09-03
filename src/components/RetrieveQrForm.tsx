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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useQrCode } from "@/hooks/use-qr-code";

export function RetrieveQrForm() {
  const [formKey, setFormKey] = useState(0);
  const qrRef = useRef<HTMLDivElement>(null);
  const { dataUrl, generating, error, generate, clear } = useQrCode();

  async function handleFormSubmit(formValues: Record<string, unknown>) {
    const studentNumber = String(formValues.studentNumber ?? "").trim();
    const url = await generate(studentNumber);
    if (url) {
      setTimeout(() => {
        qrRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    }
  }

  function handleClear() {
    clear();
    setFormKey((current) => current + 1);
  }

  return (
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
          <Button disabled={generating} type="submit">
            {generating ? "Generating..." : "Generate QR"}
          </Button>
        </CardFooter>
      </Form>
      {error ? (
        <p className="px-6 pb-4 text-sm text-destructive">{error}</p>
      ) : null}
      {dataUrl ? <QrCodePreview dataUrl={dataUrl} ref={qrRef} /> : null}
    </Card>
  );
}
