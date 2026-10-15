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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Fieldset } from "@/components/ui/fieldset";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
import { useQrCode } from "@/hooks/use-qr-code";
import {
  DEPARTMENT_GROUPS,
  getDepartmentPrograms,
  getYearLevelOptions,
  programLabel,
} from "@/lib/academic-options";
import {
  apiErrorMessage,
  readResponseJson,
  requestErrorMessage,
} from "@/lib/request-errors";
import { MAX_STUDENT_NUMBER_LENGTH } from "@/lib/students";
import { STUDENT_NUMBER_PATTERN } from "@/lib/students";
import {
  FIRST_NAME_MAX,
  FIRST_NAME_MIN,
  LAST_NAME_MAX,
  LAST_NAME_MIN,
  validateFirstName,
  validateLastName,
  validateProgramAndYear,
  validateStudentNumber,
} from "@/lib/student-validation";
import { useStudentFormStore } from "@/store/useStudentFormStore";

type QrStudentContext = {
  studentId: string;
};

type ErrorModal = {
  title: string;
  description: string;
  studentId?: string;
};

function isExistingQrResponse(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    data.code === "existing-qr"
  );
}

type Choice = { label: string; value: string };

const departmentChoices: Choice[] = DEPARTMENT_GROUPS.flatMap((group) =>
  group.departments.map((item) => ({
    label: `${item.name} (${item.code})`,
    value: item.code,
  })),
);

function findChoice(choices: Choice[], value: string): Choice | null {
  return choices.find((item) => item.value === value) ?? null;
}

function CatalogSelect({
  choices,
  disabled,
  onChange,
  placeholder,
  value,
}: {
  choices: Choice[];
  disabled?: boolean;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <Select
      disabled={disabled}
      isItemEqualToValue={(item, current) => item.value === current?.value}
      items={choices}
      onValueChange={(item) => onChange(item?.value ?? "")}
      value={findChoice(choices, value)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectPopup alignItemWithTrigger={false}>
        {choices.map((item) => (
          <SelectItem key={item.value} value={item}>
            {item.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}

export function StudentDetailsForm() {
  const [formKey, setFormKey] = useState(0);
  const department = useStudentFormStore((state) => state.department);
  const program = useStudentFormStore((state) => state.program);
  const yearLevel = useStudentFormStore((state) => state.yearLevel);
  const submitting = useStudentFormStore((state) => state.submitting);
  const setSubmitting = useStudentFormStore((state) => state.setSubmitting);
  const [errorModal, setErrorModal] = useState<ErrorModal | null>(null);
  const [syncingAccount, setSyncingAccount] = useState(false);
  const [qrStudentContext, setQrStudentContext] =
    useState<QrStudentContext | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const { dataUrl, generate, clear } = useQrCode();

  useEffect(
    () => () => {
      useStudentFormStore.getState().clearFormData();
    },
    [],
  );

  async function handleFormSubmit(formValues: Record<string, unknown>) {
    const firstName = String(formValues.firstName ?? "").trim();
    const lastName = String(formValues.lastName ?? "").trim();
    const studentNumber = String(formValues.studentNumber ?? "").trim();
    const selected = useStudentFormStore.getState();

    useStudentFormStore.getState().setFormData({
      firstName,
      lastName,
      studentNumber,
    });
    const formState = useStudentFormStore.getState();

    if (
      !firstName ||
      !lastName ||
      !studentNumber ||
      !selected.department ||
      !selected.program ||
      !selected.yearLevel
    ) {
      toastManager.add({
        type: "error",
        title: "Required fields are empty",
        description: "Complete every required student field before submitting.",
      });
      return;
    }

    const validationResults = [
      validateFirstName(firstName),
      validateLastName(lastName),
      validateStudentNumber(studentNumber),
      validateProgramAndYear(selected.department, selected.program, selected.yearLevel),
    ];
    const firstInvalid = validationResults.find((result) => !result.ok);
    if (firstInvalid && !firstInvalid.ok) {
      toastManager.add({
        type: "error",
        title: "Check your details",
        description: firstInvalid.message,
      });
      return;
    }

    const studentItem = formState.buildStudentItem();

    setSubmitting(true);
    try {
      const response = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: studentItem.full_name,
          student_id: studentItem.student_id,
          course: studentItem.course,
          department: studentItem.department,
        }),
      });

      const data = await readResponseJson(response);

      if (response.status === 409 && isExistingQrResponse(data)) {
        clear();
        setQrStudentContext(null);
        setErrorModal({
          title: "Student record already exists",
          description: apiErrorMessage(
            data,
            "This student number already has a student record. Sync account links it to this sign-in.",
          ),
          studentId: studentNumber,
        });
        return;
      }

      if (response.ok) {
        setQrStudentContext({
          studentId: studentItem.student_id,
        });
        await generate(studentItem.student_id);
        toastManager.add({
          type: "success",
          title: "Student registered",
          description: `${studentItem.full_name} · ${studentItem.student_id} · ${studentItem.course} · ${studentItem.department}`,
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

  async function handleSyncAccount() {
    const studentId = errorModal?.studentId;
    if (!studentId) {
      return;
    }

    setSyncingAccount(true);
    try {
      const response = await fetch("/api/forms/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });
      const data = await readResponseJson(response);
      if (!response.ok) {
        setErrorModal({
          title: "Account sync failed",
          description: apiErrorMessage(data, "The account sync could not be queued. Try again."),
          studentId,
        });
        return;
      }
      setErrorModal({
        title: "Account sync queued",
        description: apiErrorMessage(
          data,
          "Sign out and sign in again. Your QR code appears after the new sign-in.",
        ),
      });
    } catch (error) {
      setErrorModal({
        title: "Account sync failed",
        description: requestErrorMessage(error, "The account sync could not be queued. Try again."),
        studentId,
      });
    } finally {
      setSyncingAccount(false);
    }
  }

  function handleClear() {
    useStudentFormStore.getState().clearFormData();
    clear();
    setQrStudentContext(null);
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
            <Field className="w-full" name="firstName">
              <FieldLabel>First Name</FieldLabel>
              <Input
                autoComplete="given-name"
                maxLength={FIRST_NAME_MAX}
                minLength={FIRST_NAME_MIN}
                name="firstName"
                onChange={(event) => {
                  useStudentFormStore.getState().setFormData({
                    firstName: event.target.value,
                  });
                }}
                placeholder="Example: John Benedict"
                required
                type="text"
              />
              <FieldError>
                First name must be {FIRST_NAME_MIN} to {FIRST_NAME_MAX} characters.
              </FieldError>
            </Field>

            <Field className="w-full" name="lastName">
              <FieldLabel>Last Name</FieldLabel>
              <Input
                autoComplete="family-name"
                maxLength={LAST_NAME_MAX}
                minLength={LAST_NAME_MIN}
                name="lastName"
                onChange={(event) => {
                  useStudentFormStore.getState().setFormData({
                    lastName: event.target.value,
                  });
                }}
                placeholder="Example: Vida"
                required
                type="text"
              />
              <FieldError>
                Last name must be {LAST_NAME_MIN} to {LAST_NAME_MAX} characters.
              </FieldError>
            </Field>

            <Field className="w-full" name="studentNumber">
              <FieldLabel>Student Number</FieldLabel>
              <Input
                autoComplete="off"
                inputMode="numeric"
                maxLength={MAX_STUDENT_NUMBER_LENGTH}
                minLength={MAX_STUDENT_NUMBER_LENGTH}
                name="studentNumber"
                onChange={(event) => {
                  const digits = event.target.value
                    .replace(/\D/g, "")
                    .slice(0, MAX_STUDENT_NUMBER_LENGTH);
                  event.target.value = digits;
                  useStudentFormStore.getState().setFormData({
                    studentNumber: digits,
                  });
                }}
                pattern={STUDENT_NUMBER_PATTERN.source}
                placeholder="Example: 2024105858"
                required
                type="text"
              />
              <FieldError>
                Enter a 4-digit year followed by 6 digits.
              </FieldError>
            </Field>

            <Field className="w-full">
              <FieldLabel>Department</FieldLabel>
              <Select
                disabled={submitting}
                isItemEqualToValue={(item, current) => item.value === current?.value}
                items={departmentChoices}
                onValueChange={(item) => {
                  const code = item?.value ?? "";
                  const current = useStudentFormStore.getState();
                  const programs = getDepartmentPrograms(code);
                  const years = getYearLevelOptions(code);
                  useStudentFormStore.getState().setFormData({
                    department: code,
                    program: programs.some((entry) => entry.code === current.program)
                      ? current.program
                      : "",
                    yearLevel: years.some((year) => year === current.yearLevel)
                      ? current.yearLevel
                      : "",
                  });
                }}
                value={findChoice(departmentChoices, department)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectPopup alignItemWithTrigger={false}>
                  {DEPARTMENT_GROUPS.map((group) => (
                    <SelectGroup key={group.campus}>
                      <SelectGroupLabel>{group.campus}</SelectGroupLabel>
                      {group.departments.map((item) => {
                        const choice = departmentChoices.find(
                          (entry) => entry.value === item.code,
                        );
                        if (!choice) {
                          return null;
                        }
                        return (
                          <SelectItem key={item.code} value={choice}>
                            {choice.label}
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  ))}
                </SelectPopup>
              </Select>
            </Field>

            <Field className="w-full">
              <FieldLabel>Program</FieldLabel>
              <CatalogSelect
                choices={getDepartmentPrograms(department).map((item) => ({
                  label: programLabel(item),
                  value: item.code,
                }))}
                disabled={submitting || !department}
                onChange={(value) => {
                  useStudentFormStore.getState().setFormData({ program: value });
                }}
                placeholder={department ? "Select Program" : "Select Department first"}
                value={program}
              />
            </Field>

            <Field className="w-full">
              <FieldLabel>Year Level</FieldLabel>
              <CatalogSelect
                choices={getYearLevelOptions(department).map((year) => ({
                  label: year,
                  value: year,
                }))}
                disabled={submitting}
                onChange={(value) => {
                  useStudentFormStore.getState().setFormData({ yearLevel: value });
                }}
                placeholder="Select Year"
                value={yearLevel}
              />
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
        {dataUrl && qrStudentContext ? (
          <QrCodePreview
            key={qrStudentContext.studentId}
            dataUrl={dataUrl}
            ref={qrRef}
            studentId={qrStudentContext.studentId}
          />
        ) : null}
      </Card>
      <Dialog
        onOpenChange={(open) => {
          if (!open && !syncingAccount) {
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
            {errorModal?.studentId ? (
              <Button
                disabled={syncingAccount}
                onClick={() => void handleSyncAccount()}
                type="button"
              >
                {syncingAccount ? "Syncing account..." : "Sync account"}
              </Button>
            ) : null}
            <DialogClose
              render={<Button disabled={syncingAccount} type="button" variant="ghost" />}
            >
              OK
            </DialogClose>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </ToastProvider>
  );
}
