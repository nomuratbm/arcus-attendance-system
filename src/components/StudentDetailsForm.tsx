"use client";

import { Fragment, useEffect, useState } from "react";
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
import { departmentCampuses, departmentItems } from "@/lib/departments";
import { useStudentFormStore } from "@/store/useStudentFormStore";

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
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    setSessionReady(true);
  }, []);

  const draft = sessionReady
    ? useStudentFormStore.getState()
    : {
        studentName: "",
        studentNumber: "",
        programYear: "",
        department: "",
      };

  function handleFormSubmit(formValues: Record<string, unknown>) {
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

    toastManager.add({
      type: "success",
      title: "Student details saved",
      description: `${studentName} · ${studentNumber} · ${programYear} · ${department}`,
    });
  }

  function handleClear() {
    useStudentFormStore.getState().clearFormData();
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
          key={`${sessionReady ? "session" : "pending"}-${formKey}`}
          className="contents"
          onFormSubmit={handleFormSubmit}
        >
          <CardPanel className="flex flex-col gap-4">
            <Field className="w-full" name="studentName">
              <FieldLabel>Student Name</FieldLabel>
              <Input
                autoComplete="name"
                defaultValue={draft.studentName}
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
              <FieldError>Please enter the student's full name.</FieldError>
            </Field>

            <Field className="w-full" name="studentNumber">
              <FieldLabel>Student Number</FieldLabel>
              <Input
                autoComplete="off"
                defaultValue={draft.studentNumber}
                inputMode="numeric"
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
                defaultValue={draft.programYear}
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
              <DepartmentSelect defaultValue={draft.department} />
              <FieldError>Please select a department.</FieldError>
            </Field>
          </CardPanel>
          <CardFooter className="justify-end gap-2">
            <Button onClick={handleClear} type="reset" variant="ghost">
              Clear
            </Button>
            <Button type="submit">Save student</Button>
          </CardFooter>
        </Form>
      </Card>
    </ToastProvider>
  );
}
