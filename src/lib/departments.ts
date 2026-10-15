import { DEPARTMENT_GROUPS } from "@/lib/academic-options";

export type SelectOption = { label: string; value: string | null };

export const departmentCampuses = DEPARTMENT_GROUPS.map((group) => ({
  campus: group.campus,
  departments: group.departments.map((department) => department.name),
}));

export const departmentItems: SelectOption[] = [
  { label: "Select department", value: null },
  ...departmentCampuses.flatMap((group) =>
    group.departments.map((department) => ({
      label: department,
      value: department,
    })),
  ),
];
