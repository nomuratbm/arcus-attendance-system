"use client";

import { useEffect, useRef, useState } from "react";
import { AsyncLoadingOverlay } from "@/components/AsyncLoadingOverlay";
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
import { Field, FieldControl, FieldError, FieldLabel } from "@/components/ui/field";
import { Fieldset } from "@/components/ui/fieldset";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { selectTriggerVariants } from "@/components/ui/select";
import { ChevronsUpDownIcon } from "lucide-react";
import { ToastProvider, toastManager } from "@/components/ui/toast";
import { useQrCode } from "@/hooks/use-qr-code";
import { departmentCampuses } from "@/lib/departments";
import { cn } from "@/lib/utils";
import {
  NO_ORGANIZATION_VALUE,
  type OrganizationOption,
} from "@/lib/organizations";
import {
  apiErrorMessage,
  readResponseJson,
  requestErrorMessage,
} from "@/lib/request-errors";
import { MAX_STUDENT_NUMBER_LENGTH } from "@/lib/students";
import { useStudentFormStore } from "@/store/useStudentFormStore";

type QrMemberContext = {
  studentId: string;
  organization: OrganizationOption | null;
};

type ErrorModal = {
  title: string;
  description: string;
};

function isExistingQrResponse(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    data.code === "existing-qr"
  );
}

function organizationFromResponse(value: unknown): OrganizationOption | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("organization" in value) ||
    value.organization === null
  ) {
    return null;
  }

  const organization = value.organization;
  if (
    typeof organization !== "object" ||
    organization === null ||
    !("label" in organization) ||
    typeof organization.label !== "string" ||
    !("value" in organization) ||
    typeof organization.value !== "string"
  ) {
    return null;
  }

  return {
    label: organization.label,
    value: organization.value,
  };
}

const departmentChoices = departmentCampuses.map((group) => {
  const campusName = group.campus.replace(/ Campus$/, "");

  return {
    campus: group.campus,
    departments: group.departments.map((department) => {
      const sharedName = departmentCampuses.some(
        (other) =>
          other.campus !== group.campus &&
          other.departments.some((name) => name === department),
      );
      const label = sharedName
        ? `${department} (${campusName})`
        : department;

      return { label, value: label };
    }),
  };
});

function DepartmentSelect({
  defaultValue,
  disabled,
}: {
  defaultValue: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative w-full">
      <FieldControl
        className={cn(
          selectTriggerVariants(),
          "w-full cursor-pointer appearance-none pe-9 pointer-coarse:after:pointer-events-none",
        )}
        defaultValue={defaultValue}
        disabled={disabled}
        onValueChange={(value) => {
          useStudentFormStore.getState().setFormData({
            department: value,
          });
        }}
        render={
          <select>
            <option value="">Select department</option>
            {departmentChoices.map((group) => (
              <optgroup key={group.campus} label={group.campus}>
                {group.departments.map((department) => (
                  <option key={department.value} value={department.value}>
                    {department.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        }
        required
      />
      <ChevronsUpDownIcon className="pointer-events-none absolute end-2.5 top-1/2 size-4.5 -translate-y-1/2 opacity-80 sm:size-4" />
    </div>
  );
}

export function StudentDetailsForm() {
  const [formKey, setFormKey] = useState(0);
  const submitting = useStudentFormStore((state) => state.submitting);
  const setSubmitting = useStudentFormStore((state) => state.setSubmitting);
  const [errorModal, setErrorModal] = useState<ErrorModal | null>(null);
  const [qrMemberContext, setQrMemberContext] =
    useState<QrMemberContext | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const { dataUrl, generate, clear } = useQrCode();

  useEffect(
    () => () => {
      useStudentFormStore.getState().clearFormData();
    },
    [],
  );

  async function handleFormSubmit(formValues: Record<string, unknown>) {
    const studentName = String(formValues.studentName ?? "").trim();
    const studentNumber = String(formValues.studentNumber ?? "").trim();
    const programYear = String(formValues.programYear ?? "").trim();
    const department = String(formValues.department ?? "").trim();

    useStudentFormStore.getState().setFormData({
      studentName,
      studentNumber,
      programYear,
      department,
    });
    const formState = useStudentFormStore.getState();

    if (!studentName || !studentNumber || !programYear || !department) {
      toastManager.add({
        type: "error",
        title: "Required fields are empty",
        description: "Complete every required student field before submitting.",
      });
      return;
    }

    if (!formState.organizationSelection) {
      toastManager.add({
        type: "error",
        title: "Select an organization option",
        description: "Choose one organization or select No organization.",
      });
      return;
    }

    const memberItem = formState.buildMemberItem();

    setSubmitting(true);
    try {
      const response = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: memberItem.full_name,
          student_id: memberItem.student_id,
          course: memberItem.course,
          department: memberItem.department,
          organization_id:
            formState.organizationSelection === NO_ORGANIZATION_VALUE
              ? null
              : formState.organizationSelection,
        }),
      });

      const data = await readResponseJson(response);

      if (response.status === 409 && isExistingQrResponse(data)) {
        clear();
        setQrMemberContext(null);
        setErrorModal({
          title: "QR code already exists",
          description: apiErrorMessage(
            data,
            "This student number already has a QR code. Use Retrieve to get the existing code.",
          ),
        });
        return;
      }

      if (response.ok) {
        setQrMemberContext({
          studentId: memberItem.student_id,
          organization: organizationFromResponse(data),
        });
        await generate(memberItem.student_id);
        toastManager.add({
          type: "success",
          title: "Student registered",
          description: `${memberItem.full_name} · ${memberItem.student_id} · ${memberItem.course} · ${memberItem.department}`,
        });
        setTimeout(() => {
          qrRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 100);
      } else {
        toastManager.add({
          type: "error",
          title: "Registration failed",
          description: apiErrorMessage(
            data,
            "An unexpected error occurred. Please try again.",
          ),
        });
      }
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Registration failed",
        description: requestErrorMessage(
          error,
          "Could not register the student. Please try again.",
        ),
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleClear() {
    useStudentFormStore.getState().clearFormData();
    clear();
    setQrMemberContext(null);
    setFormKey((current) => current + 1);
  }

  return (
    <ToastProvider position="bottom-right">
      <Card aria-busy={submitting} className="relative w-full">
        {submitting ? (
          <AsyncLoadingOverlay label="Registering student..." />
        ) : null}
        <CardHeader>
          <CardTitle>Student details</CardTitle>
          <CardDescription>
            Enter the student record used for event check-in and attendance.
          </CardDescription>
        </CardHeader>
        <Form
          key={formKey}
          className="contents"
          onFormSubmit={handleFormSubmit}
        >
          <Fieldset className="contents" disabled={submitting}>
          <CardPanel className="flex flex-col gap-4">
            <Field className="w-full" name="studentName">
              <FieldLabel>Student Name</FieldLabel>
              <Input
                autoComplete="name"
                name="studentName"
                onChange={(event) => {
                  useStudentFormStore.getState().setFormData({
                    studentName: event.target.value,
                  });
                }}
                placeholder="Example: John Benedict Vida"
                required
                type="text"
              />
              <FieldError>Please enter the student&apos;s full name.</FieldError>
            </Field>

            <Field className="w-full" name="studentNumber">
              <FieldLabel>Student Number</FieldLabel>
              <Input
                autoComplete="off"
                inputMode="numeric"
                maxLength={MAX_STUDENT_NUMBER_LENGTH}
                name="studentNumber"
                onChange={(event) => {
                  useStudentFormStore.getState().setFormData({
                    studentNumber: event.target.value,
                  });
                }}
                placeholder="Example: 2024105858"
                required
                type="text"
              />
              <FieldError>Please enter a student number.</FieldError>
            </Field>

            <Field className="w-full" name="programYear">
              <FieldLabel>Program - Year</FieldLabel>
              <Input
                autoComplete="off"
                name="programYear"
                onChange={(event) => {
                  useStudentFormStore.getState().setFormData({
                    programYear: event.target.value,
                  });
                }}
                placeholder="Example: CS-3"
                required
                type="text"
              />
              <FieldError>Please enter the program and year.</FieldError>
            </Field>

            <Field className="w-full" name="department">
              <FieldLabel>Department</FieldLabel>
              <DepartmentSelect defaultValue="" disabled={submitting} />
              <FieldError>Please select a department.</FieldError>
            </Field>
          </CardPanel>
          <CardFooter className="justify-end gap-2">
            <Button onClick={handleClear} type="reset" variant="ghost">
              Clear
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Registering..." : "Save student"}
            </Button>
          </CardFooter>
          </Fieldset>
        </Form>
        {dataUrl && qrMemberContext ? (
          <QrCodePreview
            key={qrMemberContext.studentId}
            dataUrl={dataUrl}
            organization={qrMemberContext.organization}
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
            <DialogClose render={<Button type="button" variant="ghost" />}>
              OK
            </DialogClose>
            <Button render={<a href="/retrieve" />}>Retrieve QR</Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </ToastProvider>
  );
}
