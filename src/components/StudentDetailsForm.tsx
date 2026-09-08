"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
} from "react";
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
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToastProvider, toastManager } from "@/components/ui/toast";
import { useQrCode } from "@/hooks/use-qr-code";
import { departmentCampuses, departmentItems } from "@/lib/departments";
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
import { useStudentFormStore } from "@/store/useStudentFormStore";

type QrMemberContext = {
  studentId: string;
  organizations: OrganizationOption[];
};

const departmentSelectGroups = departmentCampuses.map((group, index) => (
  <Fragment key={group.campus}>
    {index > 0 ? <SelectSeparator /> : null}
    <SelectGroup>
      <SelectGroupLabel>{group.campus}</SelectGroupLabel>
      {group.departments.map((department) => (
        <SelectItem
          className="items-start whitespace-normal"
          key={department}
          value={department}
        >
          {department}
        </SelectItem>
      ))}
    </SelectGroup>
  </Fragment>
));

function departmentFromSelectValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "value" in value &&
    typeof value.value === "string"
  ) {
    return value.value;
  }

  return "";
}

function DepartmentSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <Select
      defaultValue={defaultValue || null}
      items={departmentItems}
      name="department"
      onValueChange={(value) => {
        useStudentFormStore.getState().setFormData({
          department: departmentFromSelectValue(value),
        });
      }}
      required
    >
      <SelectTrigger>
        <SelectValue placeholder="Select department" />
      </SelectTrigger>
      <SelectPopup alignItemWithTrigger={false}>
        {departmentSelectGroups}
      </SelectPopup>
    </Select>
  );
}

export function StudentDetailsForm() {
  const [formKey, setFormKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
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

    if (
      formState.organizationIds.length === 0 &&
      !formState.noOrganizationSelected
    ) {
      toastManager.add({
        type: "error",
        title: "Select an organization option",
        description:
          "Choose at least one organization or select No organization.",
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
          organization_ids: formState.organizationIds,
          no_organization: formState.noOrganizationSelected,
        }),
      });

      const data = await readResponseJson(response);

      if (response.ok) {
        const selectedOrganizations = parseOrganizationOptions(data);
        setQrMemberContext({
          studentId: memberItem.student_id,
          organizations: selectedOrganizations,
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
      } else if (response.status === 409) {
        toastManager.add({
          type: "error",
          title: "Already registered",
          description:
            "This student number is already registered. Use Retrieve to get your QR code.",
        });
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
      <Card className="w-full">
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
              <DepartmentSelect defaultValue="" />
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
    </ToastProvider>
  );
}
