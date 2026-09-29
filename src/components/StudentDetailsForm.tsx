"use client";

import {
  Fragment,
  useEffect,
  useState,
} from "react";
import { AsyncLoadingOverlay } from "@/components/AsyncLoadingOverlay";
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
import { Fieldset } from "@/components/ui/fieldset";
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
import { toastManager } from "@/components/ui/toast";
import { departmentCampuses, departmentItems } from "@/lib/departments";
import {
  apiErrorMessage,
  readResponseJson,
  requestErrorMessage,
} from "@/lib/request-errors";
import { MAX_STUDENT_NUMBER_LENGTH } from "@/lib/students";
import { useStudentFormStore } from "@/store/useStudentFormStore";

export type RegisteredStudent = {
  course: string;
  currentOrganization: string;
  department: string;
  fullName: string;
  studentId: string;
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

function DepartmentSelect({
  defaultValue,
  disabled,
}: {
  defaultValue: string;
  disabled?: boolean;
}) {
  return (
    <Select
      defaultValue={defaultValue || null}
      disabled={disabled}
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

export function StudentDetailsForm({
  onRegistered,
}: {
  onRegistered: (student: RegisteredStudent) => void;
}) {
  const [formKey, setFormKey] = useState(0);
  const submitting = useStudentFormStore((state) => state.submitting);
  const setSubmitting = useStudentFormStore((state) => state.setSubmitting);

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
    const memberItem = useStudentFormStore.getState().buildMemberItem();

    if (!studentName || !studentNumber || !programYear || !department) {
      toastManager.add({
        type: "error",
        title: "Required fields are empty",
        description: "Complete every required student field before submitting.",
      });
      return;
    }

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
        }),
      });

      const data = await readResponseJson(response);

      if (response.ok && data && typeof data === "object") {
        const studentId =
          "student_id" in data && typeof data.student_id === "string"
            ? data.student_id
            : memberItem.student_id;
        const fullName =
          "full_name" in data && typeof data.full_name === "string"
            ? data.full_name
            : memberItem.full_name;
        const course =
          "course" in data && typeof data.course === "string"
            ? data.course
            : memberItem.course;
        const savedDepartment =
          "department" in data && typeof data.department === "string"
            ? data.department
            : memberItem.department;
        const currentOrganization =
          "current_organization" in data &&
          typeof data.current_organization === "string"
            ? data.current_organization
            : "";

        toastManager.add({
          type: "success",
          title: "Student registered",
          description: `${fullName} · ${studentId} · ${course} · ${savedDepartment}`,
        });
        onRegistered({
          course,
          currentOrganization,
          department: savedDepartment,
          fullName,
          studentId,
        });
      } else if (response.status === 409) {
        toastManager.add({
          type: "error",
          title: "Already registered",
          description: apiErrorMessage(
            data,
            "This student number is already registered to another account.",
          ),
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
    setFormKey((current) => current + 1);
  }

  return (
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
            <Button loading={submitting} type="submit">
              Save student
            </Button>
          </CardFooter>
          </Fieldset>
        </Form>
    </Card>
  );
}
