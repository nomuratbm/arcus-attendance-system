"use client";

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
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
import { ThemeToggle } from "@/components/ThemeToggle";

type SelectOption = { label: string; value: string | null };

const departmentCampuses = [
  {
    campus: "Intramuros Campus",
    departments: [
      "School of Architecture, Industrial Design, and the Built Environment",
      "School of Chemical, Biological, and Materials Engineering and Sciences",
      "School of Civil, Environmental, and Geological Engineering",
      "School of Electrical, Electronics, and Computer Engineering",
      "School of Industrial Engineering and Engineering Management",
      "School of Mechanical, Manufacturing, and Energy Engineering",
      "School of Foundational Studies and Education",
      "Department of Liberal Arts",
      "Department of Mathematics",
      "Department of Physical Education and Athletics",
      "Department of Physics",
    ],
  },
  {
    campus: "Makati Campus",
    departments: [
      "School of Information Technology",
      "School of Multimedia and Digital Arts",
      "E.T. Yuchengco School of Business",
      "School of Health Sciences",
      "School of Nursing",
      "School of Medicine",
    ],
  },
  {
    campus: "Seda Hotel, Manila Bay",
    departments: ["School of Tourism and Hospitality Management"],
  },
] as const;

const departmentItems: SelectOption[] = [
  { label: "Select department", value: null },
  ...departmentCampuses.flatMap((group) =>
    group.departments.map((department) => ({
      label: department,
      value: department,
    })),
  ),
];

function StudentDetailsForm() {
  const [formKey, setFormKey] = useState(0);

  return (
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
        onFormSubmit={(formValues) => {
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
        }}
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
            <Select items={departmentItems} name="department" required>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectPopup alignItemWithTrigger={false}>
                {departmentCampuses.map((group, index) => (
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
                ))}
              </SelectPopup>
            </Select>
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
  );
}

export default function Home() {
  return (
    <ToastProvider position="bottom-right">
      <div className="min-h-screen bg-background text-foreground transition-colors duration-150">
        <header className="border-b bg-card">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-foreground">
                  Arcus Attendance
                </h1>
                <Badge size="sm" variant="outline">
                  AWS Student Builder Group
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Student registration
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                render={<a href="/scanner" />}
                size="sm"
                variant="outline"
              >
                Scanner
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-xl px-6 py-8">
          <StudentDetailsForm />
        </main>
      </div>
    </ToastProvider>
  );
}
