"use client";

import { Fragment, useState } from "react";
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

function DepartmentSelect() {
  return (
    <Select items={departmentItems} name="department" required>
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

  function handleFormSubmit(formValues: Record<string, unknown>) {
    const studentName = String(formValues.studentName ?? "");
    const studentNumber = String(formValues.studentNumber ?? "");
    const programYear = String(formValues.programYear ?? "");
    const department = String(formValues.department ?? "");

    toastManager.add({
      type: "success",
      title: "Student details captured",
      description: `${studentName} · ${studentNumber} · ${programYear} · ${department}`,
    });
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
                inputMode="numeric"
                name="studentNumber"
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
                placeholder="Example: CS-3"
                required
                type="text"
              />
              <FieldError>Please enter the program and year.</FieldError>
            </Field>

            <Field className="w-full" name="department">
              <FieldLabel>Department</FieldLabel>
              <DepartmentSelect />
              <FieldError>Please select a department.</FieldError>
            </Field>
          </CardPanel>
          <CardFooter className="justify-end gap-2">
            <Button type="reset" variant="ghost">
              Clear
            </Button>
            <Button type="submit">Save student</Button>
          </CardFooter>
        </Form>
      </Card>
    </ToastProvider>
  );
}
