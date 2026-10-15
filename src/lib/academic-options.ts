/** Department, program, and year catalogs shared with the SAAF proponent form. */

export interface DepartmentItem {
  code: string
  name: string
}

export interface DepartmentGroup {
  campus: string
  departments: readonly DepartmentItem[]
}

export const DEPARTMENT_GROUPS: readonly DepartmentGroup[] = [
  {
    campus: "Intramuros Campus",
    departments: [
      { code: "ARIDBE", name: "School of Architecture, Industrial Design, and the Built Environment" },
      { code: "CBMES", name: "School of Chemical, Biological, and Materials Engineering and Sciences" },
      { code: "CEGE", name: "School of Civil, Environmental, and Geological Engineering" },
      { code: "EECE", name: "School of Electrical, Electronics, and Computer Engineering" },
      { code: "IE-EM", name: "School of Industrial Engineering and Engineering Management" },
      { code: "MME", name: "School of Mechanical, Manufacturing, and Energy Engineering" },
      { code: "SFSE", name: "School of Foundational Studies and Education" },
      { code: "DLA", name: "Department of Liberal Arts" },
      { code: "MATH", name: "Department of Mathematics" },
      { code: "PE", name: "Department of Physical Education and Athletics" },
      { code: "PHYS", name: "Department of Physics" },
      { code: "SHS-INTRA", name: "SHS (Intramuros)" },
    ],
  },
  {
    campus: "Makati Campus",
    departments: [
      { code: "SOIT", name: "School of Information Technology" },
      { code: "SMDA", name: "School of Multimedia and Digital Arts" },
      { code: "ETYSB", name: "E.T. Yuchengco School of Business" },
      { code: "SHS-HEALTH", name: "School of Health Sciences" },
      { code: "SON", name: "School of Nursing" },
      { code: "SOM", name: "School of Medicine" },
      { code: "SHS-MAKATI", name: "SHS (Makati)" },
    ],
  },
  {
    campus: "Seda Hotel, Manila Bay",
    departments: [
      { code: "STHM", name: "School of Tourism and Hospitality Management" },
    ],
  },
] as const

export const ALL_DEPARTMENT_ITEMS: readonly DepartmentItem[] = DEPARTMENT_GROUPS.flatMap(
  (group) => group.departments
)

export const DEPARTMENTS = ALL_DEPARTMENT_ITEMS.map((dept) => dept.name) as readonly string[]

export type Department = (typeof DEPARTMENTS)[number]

export function getDepartmentItem(nameOrCode: string | null | undefined): DepartmentItem | undefined {
  if (!nameOrCode) return undefined
  const needle = nameOrCode.trim().toUpperCase()
  return ALL_DEPARTMENT_ITEMS.find(
    (d) => d.code.toUpperCase() === needle || d.name.toUpperCase() === needle
  )
}

export const COLLEGE_YEAR_LEVEL_OPTIONS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
] as const

export const SHS_YEAR_LEVEL_OPTIONS = ["11", "12"] as const

export const YEAR_LEVEL_OPTIONS = [
  ...COLLEGE_YEAR_LEVEL_OPTIONS,
  ...SHS_YEAR_LEVEL_OPTIONS,
] as const

export type YearLevel = (typeof YEAR_LEVEL_OPTIONS)[number]

export function isShsDepartment(nameOrCode: string | null | undefined): boolean {
  if (!nameOrCode) return false
  const item = getDepartmentItem(nameOrCode)
  const code = item?.code ?? nameOrCode.trim().toUpperCase()
  return code === "SHS-INTRA" || code === "SHS-MAKATI"
}

export function getYearLevelOptions(
  deptNameOrCode: string | null | undefined
): readonly string[] {
  return isShsDepartment(deptNameOrCode)
    ? SHS_YEAR_LEVEL_OPTIONS
    : COLLEGE_YEAR_LEVEL_OPTIONS
}

export interface ProgramItem {
  code: string
  name: string
}

export const DEPARTMENT_PROGRAMS: Record<string, readonly ProgramItem[]> = {
  // Intramuros Campus
  ARIDBE: [
    { code: "BS-AR", name: "BS Architecture" },
    { code: "BS-ID", name: "BS Industrial Design" },
    { code: "BS-INT", name: "BS Interior Design" },
    { code: "BS-EP", name: "BS Environmental Planning" },
    { code: "BS-UP", name: "BS Urban Planning" },
    { code: "MS-AR", name: "MS Architecture" },
    { code: "BS-AR → MS-AR", name: "BS Architecture → MS Architecture" },
  ],
  CBMES: [
    { code: "BSChE", name: "BS Chemical Engineering" },
    { code: "BS-CHM", name: "BS Chemistry" },
    { code: "BSBE", name: "BS Biological Engineering" },
    { code: "BSMSE", name: "BS Materials Science and Engineering" },
    { code: "BSChE + BS-CHM", name: "BS Chemical Engineering + BS Chemistry" },
    { code: "MSBE", name: "MS Biological Engineering" },
    { code: "MSChE", name: "MS Chemical Engineering" },
    { code: "MS-CHM", name: "MS Chemistry" },
    { code: "MSMSE", name: "MS Materials Science and Engineering" },
    { code: "PhD-ChE", name: "PhD in Chemical Engineering" },
    { code: "PhD-CHM", name: "PhD in Chemistry" },
    { code: "PhD-MSE", name: "PhD in Materials Science and Engineering" },
    { code: "BSBE → MSBE", name: "BS Biological Engineering → MS Biological Engineering" },
    { code: "BSChE → MSChE", name: "BS Chemical Engineering → MS Chemical Engineering" },
    { code: "BSMSE → MSMSE", name: "BS Materials Science and Engineering → MS Materials Science and Engineering" },
  ],
  CEGE: [
    { code: "BSCE", name: "BS Civil Engineering" },
    { code: "BS-ENSE", name: "BS Environmental and Sanitary Engineering" },
    { code: "BS-GEO", name: "BS Geology" },
    { code: "BSCEM", name: "BS Construction Engineering and Management" },
    { code: "BSGSE", name: "BS Geological Science and Engineering" },
    { code: "BSCE + BSMSE", name: "BS Civil Engineering + BS Materials Science and Engineering" },
    { code: "BSCE + BS-ENSE", name: "BS Civil Engineering + BS Environmental and Sanitary Engineering" },
    { code: "MSCE", name: "MS Civil Engineering" },
    { code: "MSCEM", name: "MS Construction Engineering and Management" },
    { code: "MSEnE", name: "MS Environmental Engineering" },
    { code: "PhD-EnE", name: "PhD in Environmental Engineering" },
    { code: "BSCE → MSCE", name: "BS Civil Engineering → MS Civil Engineering" },
    { code: "BSCEM → MSCEM", name: "BS Construction Engineering and Management → MS Construction Engineering and Management" },
  ],
  EECE: [
    { code: "BSEE", name: "BS Electrical Engineering" },
    { code: "BSCpE", name: "BS Computer Engineering" },
    { code: "BSECE", name: "BS Electronics Engineering" },
    { code: "BSAIE", name: "BS Artificial Intelligence Engineering" },
    { code: "ME-CpE", name: "Master of Engineering in Computer Engineering" },
    { code: "ME-EE", name: "Master of Engineering in Electrical Engineering" },
    { code: "ME-ECE", name: "Master of Engineering in Electronics Engineering" },
    { code: "MSCpE", name: "MS Computer Engineering" },
    { code: "MSEE", name: "MS Electrical Engineering" },
    { code: "MSECE", name: "MS Electronics Engineering" },
    { code: "PhD-CpE", name: "PhD in Computer Engineering" },
    { code: "PhD-ECE", name: "PhD in Electronics Engineering" },
    { code: "BSECE → MSECE", name: "BS Electronics Engineering → MS Electronics Engineering" },
    { code: "BSEE → MSEE", name: "BS Electrical Engineering → MS Electrical Engineering" },
    { code: "BSCpE → MSCpE", name: "BS Computer Engineering → MS Computer Engineering" },
  ],
  "IE-EM": [
    { code: "BSIE", name: "BS Industrial Engineering" },
    { code: "BSManE", name: "BS Management Engineering" },
    { code: "ME-IE", name: "Master of Engineering in Industrial Engineering" },
    { code: "MSEM", name: "MS Engineering Management" },
    { code: "MSIE", name: "MS Industrial Engineering" },
    { code: "PhD-IE", name: "PhD in Industrial Engineering" },
    { code: "BSIE → MSIE", name: "BS Industrial Engineering → MS Industrial Engineering" },
    { code: "BSManE → MSSEM", name: "BS Management Engineering → MS Service Engineering and Management" },
  ],
  MME: [
    { code: "BSME", name: "BS Mechanical Engineering" },
    { code: "BSEnE", name: "BS Energy Engineering" },
    { code: "BSMfgE", name: "BS Manufacturing Engineering" },
    { code: "BSME + BSBE", name: "BS Mechanical Engineering + BS Biological Engineering" },
    { code: "BSME + BSMSE", name: "BS Mechanical Engineering + BS Materials Science and Engineering" },
    { code: "MSME", name: "MS Mechanical Engineering" },
    { code: "PhD-ME", name: "PhD in Mechanical Engineering" },
    { code: "BSME → MSME", name: "BS Mechanical Engineering → MS Mechanical Engineering" },
  ],
  SFSE: [
    { code: "BSTC", name: "BS Technical Communication" },
    { code: "BPE-SWM", name: "Bachelor of Physical Education Major in Sports Wellness and Management" },
    { code: "BS-PHY", name: "BS Physics" },
  ],
  DLA: [
    { code: "BSTC", name: "BS Technical Communication" },
    { code: "BA-COMM", name: "BA Communication" },
    { code: "BA-BM", name: "BA Broadcast Media" },
    { code: "GenEd", name: "General Education" },
  ],
  MATH: [
    { code: "BS-MATH", name: "BS Mathematics" },
    { code: "BS-AMATH", name: "BS Applied Mathematics" },
    { code: "BSDS", name: "BS Data Science" },
  ],
  PE: [
    { code: "BPE-SWM", name: "Bachelor of Physical Education Major in Sports Wellness and Management" },
    { code: "PE", name: "Physical Education" },
  ],
  PHYS: [
    { code: "BS-PHY", name: "BS Physics" },
    { code: "BS-PHY + BSECE", name: "BS Physics + BS Electronics Engineering" },
    { code: "BS-PHY + BSEE", name: "BS Physics + BS Electrical Engineering" },
    { code: "BS-PHY + BSMSE", name: "BS Physics + BS Materials Science and Engineering" },
  ],
  "SHS-INTRA": [
    { code: "STEM", name: "Science, Technology, Engineering, and Mathematics" },
    { code: "ABM", name: "Accountancy, Business, and Management" },
    { code: "HUMSS", name: "Humanities and Social Sciences" },
    { code: "GAS", name: "General Academic Strand" },
  ],
  // Makati Campus
  SOIT: [
    { code: "BSIT", name: "BS Information Technology" },
    { code: "BSCS", name: "BS Computer Science" },
    { code: "BSDS", name: "BS Data Science" },
    { code: "BSEMC", name: "BS Entertainment and Multimedia Computing" },
    { code: "BSIS", name: "BS Information Systems" },
    { code: "BSCS-CYBER", name: "BS Cybersecurity" },
    { code: "MIT", name: "Master in Information Technology" },
    { code: "MSCS", name: "MS Computer Science" },
    { code: "PhD-CS", name: "PhD in Computer Science" },
    { code: "BSCS → MSCS", name: "BS Computer Science → MS Computer Science" },
    { code: "BSIS → MANAL", name: "BS Information Systems → Master in Business Analytics" },
    { code: "BSIT → MIT", name: "BS Information Technology → Master in Information Technology" },
  ],
  SMDA: [
    { code: "BADF", name: "BA Digital Film" },
    { code: "BADJ", name: "BA Digital Journalism" },
    { code: "BMMA", name: "BA Multimedia Arts" },
    { code: "BAAD", name: "BA Advertising Design" },
    { code: "BABM", name: "BA Broadcast Media" },
    { code: "BMMA + BABM", name: "BA Multimedia Arts + BA Broadcast Media" },
    { code: "BMMA + BADJ", name: "BA Multimedia Arts + BA Digital Journalism" },
    { code: "MAMMA", name: "MA Multimedia Arts" },
    { code: "MAFP", name: "MA Film Production" },
    { code: "PhD-MMA", name: "PhD in Multimedia Arts" },
    { code: "BMMA → MAMMA", name: "BA Multimedia Arts → MA Multimedia Arts" },
  ],
  ETYSB: [
    { code: "BSA", name: "BS Accountancy" },
    { code: "BSBA", name: "BS Business Administration" },
    { code: "BSBA-AI", name: "BS Business Analytics with AI" },
    { code: "BSIB", name: "BS International Business" },
    { code: "BSM", name: "BS Marketing" },
    { code: "BSREM", name: "BS Real Estate Management" },
    { code: "BSBIA", name: "BS Business Intelligence and Analytics" },
    { code: "BSFinTech", name: "BS Financial Technology" },
    { code: "BSGM", name: "BS Global Management" },
    { code: "BSEntrep", name: "BS Entrepreneurship" },
    { code: "MBA", name: "Master in Business Administration" },
    { code: "MANAL", name: "Master in Business Analytics" },
    { code: "DBA", name: "Doctor of Business Administration" },
    { code: "BSA → MANAL", name: "BS Accountancy → Master in Business Analytics" },
    { code: "BSBA → MANAL", name: "BS Business Administration → Master in Business Analytics" },
  ],
  "SHS-HEALTH": [
    { code: "BA-PSY", name: "BA Psychology" },
    { code: "BS-BIO", name: "BS Biology" },
    { code: "BSMT", name: "BS Medical Technology" },
    { code: "BS-PHARM", name: "BS Pharmacy" },
    { code: "BSPT", name: "BS Physical Therapy" },
    { code: "BS-PSY", name: "BS Psychology" },
    { code: "BSRT", name: "BS Radiologic Technology" },
    { code: "MAPSY", name: "MA Psychology" },
    { code: "BA-PSY → MAPSY", name: "BA Psychology → MA Psychology" },
    { code: "BS-PSY → MAPSY", name: "BS Psychology → MA Psychology" },
  ],
  SON: [
    { code: "BSN", name: "BS Nursing" },
  ],
  SOM: [
    { code: "MD", name: "Doctor of Medicine" },
  ],
  "SHS-MAKATI": [
    { code: "STEM", name: "Science, Technology, Engineering, and Mathematics" },
    { code: "ABM", name: "Accountancy, Business, and Management" },
    { code: "HUMSS", name: "Humanities and Social Sciences" },
    { code: "GAS", name: "General Academic Strand" },
    { code: "ADT", name: "Arts and Design Track" },
  ],
  // Seda Hotel, Manila Bay
  STHM: [
    { code: "BSTM", name: "BS Tourism Management" },
    { code: "BSHM", name: "BS Hospitality Management" },
  ],
}

// Index programs by full name as well for reverse compatibility
ALL_DEPARTMENT_ITEMS.forEach((dept) => {
  if (DEPARTMENT_PROGRAMS[dept.code] && !DEPARTMENT_PROGRAMS[dept.name]) {
    DEPARTMENT_PROGRAMS[dept.name] = DEPARTMENT_PROGRAMS[dept.code]
  }
})

export function getDepartmentPrograms(deptNameOrCode: string | null | undefined): readonly ProgramItem[] {
  const item = getDepartmentItem(deptNameOrCode)
  if (!item) return []
  return DEPARTMENT_PROGRAMS[item.code] ?? []
}

export function getProgramItem(
  deptNameOrCode: string | null | undefined,
  progNameOrCode: string | null | undefined
): ProgramItem | undefined {
  if (!progNameOrCode) return undefined
  const programs = getDepartmentPrograms(deptNameOrCode)
  const needle = progNameOrCode.trim().toUpperCase()
  const found = programs.find((p) => p.code.toUpperCase() === needle || p.name.toUpperCase() === needle)
  if (found) return found

  // Global fallback across all programs
  for (const list of Object.values(DEPARTMENT_PROGRAMS)) {
    const match = list.find((p) => p.code.toUpperCase() === needle || p.name.toUpperCase() === needle)
    if (match) return match
  }
  return undefined
}

/** Same combined value the proponent form stores in programAndYear. */
export function formatProgramAndYear(program: string, yearLevel: string): string {
  const code = program.trim();
  const year = yearLevel.trim();
  if (code && year) {
    return `${code} - ${year}`;
  }
  return code || year;
}

export function programLabel(program: { code: string; name: string }): string {
  return program.name === program.code
    ? program.code
    : `${program.name} (${program.code})`;
}
