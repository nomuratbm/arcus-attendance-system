export type SelectOption = { label: string; value: string | null };

export const departmentCampuses = [
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

export const departmentItems: SelectOption[] = [
  { label: "Select department", value: null },
  ...departmentCampuses.flatMap((group) =>
    group.departments.map((department) => ({
      label: department,
      value: department,
    })),
  ),
];
